/**
 * Data migration script: Migrate document.meta.history to DocumentHistory table
 *
 * This script:
 * 1. Reads documents in batches to avoid memory issues
 * 2. Parses the history array for each document
 * 3. Creates DocumentHistory records for each history entry
 * 4. Preserves the original meta.history for rollback safety (can be removed manually later)
 *
 * Usage:
 *   npx ts-node server/scripts/migrateDocumentHistory.ts
 *
 * Options:
 *   --batch-size=N       Number of documents to process per batch (default: 100)
 *   --skip=N             Skip first N documents (for resuming)
 *   --limit=N            Process only N documents (for testing)
 *   --clean-history      Remove original meta.history after verifying migration (can be used alone)
 *   --clean-batch-size=N Batch size for cleaning operation (default: 100)
 *
 * Examples:
 *   # Test with first 10 documents
 *   npx ts-node server/scripts/migrateDocumentHistory.ts --limit=10
 *
 *   # Process with custom batch size
 *   npx ts-node server/scripts/migrateDocumentHistory.ts --batch-size=50
 *
 *   # Resume from document 1000
 *   npx ts-node server/scripts/migrateDocumentHistory.ts --skip=1000
 *
 *   # Clean up meta.history after migration (standalone)
 *   npx ts-node server/scripts/migrateDocumentHistory.ts --clean-history
 *
 *   # Clean with custom batch size
 *   npx ts-node server/scripts/migrateDocumentHistory.ts --clean-history --clean-batch-size=50
 */

import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

interface LegacyHistoryItem {
  content?: string;
  fileUrl?: string;
  description: string;
  date: string | Date;
  userId?: string;
  email?: string;
  imageBase64?: string;
  chosenDocumentIds?: string;
  additionalContextFromUserFiles?: any;
  templateDocumentId?: string | null;
  currentVersionUrl?: string;
  rating?: any;
}

interface MigrationStats {
  totalDocuments: number;
  processedCount: number;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  totalHistoryEntries: number;
  startTime: Date;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    batchSize: 100,
    skip: 0,
    limit: undefined as number | undefined,
    cleanHistory: false,
    cleanBatchSize: 100,
  };

  for (const arg of args) {
    if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--skip=')) {
      options.skip = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--clean-history') {
      options.cleanHistory = true;
    } else if (arg.startsWith('--clean-batch-size=')) {
      options.cleanBatchSize = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

async function processBatch(
  skip: number,
  batchSize: number,
  stats: MigrationStats
): Promise<boolean> {
  console.log(
    `\n📦 Processing batch: documents ${skip + 1} to ${skip + batchSize}...`
  );

  const documents = await prisma.document.findMany({
    where: {
      meta: {
        path: ['history'],
        not: Prisma.DbNull,
      },
    },
    select: {
      id: true,
      type: true,
      meta: true,
      creatorUserId: true,
      creator: {
        select: {
          email: true,
        },
      },
    },
    skip,
    take: batchSize,
    orderBy: {
      createdAt: 'asc', // Process oldest first for consistency
    },
  });

  if (documents.length === 0) {
    console.log('✅ No more documents to process\n');
    return false; // No more documents
  }

  console.log(`   Found ${documents.length} documents in this batch`);

  for (const doc of documents) {
    stats.processedCount++;

    try {
      const meta = doc.meta as Prisma.JsonObject;
      const historyData = meta?.history;

      if (!historyData) {
        stats.skippedCount++;
        continue;
      }

      // Parse history array
      let historyArray: LegacyHistoryItem[] = [];

      if (typeof historyData === 'string') {
        try {
          historyArray = JSON.parse(historyData);
        } catch (parseError) {
          console.error(
            `   ❌ Error parsing history for document ${doc.id}:`,
            parseError
          );
          stats.errorCount++;
          continue;
        }
      } else if (Array.isArray(historyData)) {
        historyArray = historyData as unknown as LegacyHistoryItem[];
      } else {
        stats.skippedCount++;
        continue;
      }

      if (!Array.isArray(historyArray) || historyArray.length === 0) {
        stats.skippedCount++;
        continue;
      }

      // Check if already migrated
      const existingHistoryCount = await prisma.documentHistory.count({
        where: { documentId: doc.id },
      });

      if (existingHistoryCount > 0) {
        stats.skippedCount++;
        continue;
      }

      console.log(
        `   📄 Migrating document ${doc.id.substring(0, 8)}... (${
          historyArray.length
        } entries)`
      );

      // Migrate each history entry
      // History array is ordered with newest first (unshift was used), so reverse for proper version numbering
      const reversedHistory = [...historyArray].reverse();
      let successfulMigrations = 0;

      for (let i = 0; i < reversedHistory.length; i++) {
        const item = reversedHistory[i];
        const versionNumber = i + 1; // Start from 1

        try {
          const creatorUserId = item.userId || doc.creatorUserId;
          const creatorEmail = item.email || doc.creator.email;

          // Only store content for non-PROTOTYPE/PRODUCT types to save space
          const shouldStoreContent =
            doc.type !== 'PROTOTYPE' && doc.type !== 'PRODUCT' && item.content;

          await prisma.documentHistory.create({
            data: {
              documentId: doc.id,
              versionNumber,
              description: item.description || 'No description',
              fileUrl: item.fileUrl || null,
              currentVersionUrl: item.currentVersionUrl || null,
              content: shouldStoreContent ? item.content : null,
              chosenDocumentIds: item.chosenDocumentIds || null,
              rating: item.rating || null,
              creatorUserId,
              creatorEmail,
              createdAt: item.date ? new Date(item.date) : new Date(),
            },
          });

          successfulMigrations++;
          stats.totalHistoryEntries++;
        } catch (itemError) {
          console.error(
            `      ❌ Error migrating history item ${i + 1}:`,
            itemError
          );
        }
      }

      if (successfulMigrations > 0) {
        stats.migratedCount++;
        console.log(
          `      ✅ Migrated ${successfulMigrations}/${historyArray.length} entries`
        );
      }
    } catch (docError) {
      console.error(`   ❌ Error processing document ${doc.id}:`, docError);
      stats.errorCount++;
    }
  }

  // Print batch summary
  const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;
  const rate = stats.processedCount / elapsed;
  console.log(
    `\n   📊 Batch completed: ${documents.length} documents processed`
  );
  console.log(
    `   ⏱️  Rate: ${rate.toFixed(2)} docs/sec | Elapsed: ${elapsed.toFixed(1)}s`
  );

  return documents.length === batchSize; // More documents available if we got a full batch
}

// Clean up meta.history field after successful migration
async function cleanHistoryBatch(
  skip: number,
  batchSize: number,
  stats: { cleaned: number; skipped: number; errors: number }
): Promise<boolean> {
  console.log(
    `\n🧹 Cleaning batch: documents ${skip + 1} to ${skip + batchSize}...`
  );

  // Find documents with meta.history that have been migrated to DocumentHistory table
  const documents = await prisma.document.findMany({
    where: {
      meta: {
        path: ['history'],
        not: Prisma.DbNull,
      },
    },
    select: {
      id: true,
      meta: true,
    },
    skip,
    take: batchSize,
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (documents.length === 0) {
    console.log('✅ No more documents to clean\n');
    return false;
  }

  console.log(`   Found ${documents.length} documents with meta.history`);

  for (const doc of documents) {
    try {
      // Verify that this document has been migrated to DocumentHistory
      const historyCount = await prisma.documentHistory.count({
        where: { documentId: doc.id },
      });

      if (historyCount === 0) {
        console.log(
          `   ⚠️  Skipping ${doc.id.substring(
            0,
            8
          )}... (no history in new table)`
        );
        stats.skipped++;
        continue;
      }

      // Remove the history field from meta
      const currentMeta = doc.meta as Prisma.JsonObject;
      const { history, ...cleanedMeta } = currentMeta as any;

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          meta: cleanedMeta,
        },
      });

      stats.cleaned++;
    } catch (error) {
      console.error(`   ❌ Error cleaning document ${doc.id}:`, error);
      stats.errors++;
    }
  }

  console.log(`   ✅ Cleaned ${stats.cleaned} documents in this batch`);
  return documents.length === batchSize;
}

async function cleanMetaHistory(batchSize: number) {
  console.log('🧹 Starting meta.history cleanup...');
  console.log(`⚙️  Configuration:`);
  console.log(`   - Batch size: ${batchSize} documents\n`);

  // First, verify that migration has been completed
  const totalDocumentsWithHistory = await prisma.document.count({
    where: {
      meta: {
        path: ['history'],
        not: Prisma.DbNull,
      },
    },
  });

  const totalMigratedDocuments = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT document_id) as count 
    FROM "documentHistories"
  `;

  const migratedCount = Number(totalMigratedDocuments[0].count);

  console.log(`📊 Pre-cleanup Status:`);
  console.log(`   Documents with meta.history: ${totalDocumentsWithHistory}`);
  console.log(`   Documents migrated to new table: ${migratedCount}\n`);

  if (migratedCount === 0) {
    console.log('⚠️  Warning: No documents have been migrated yet!');
    console.log('   Please run migration first before cleaning.\n');
    return;
  }

  // Ask for confirmation (in production, you might want to add an interactive prompt)
  console.log(
    '⚠️  This will remove meta.history from documents that have been migrated.'
  );
  console.log(
    '💡 Make sure you have verified the migration before proceeding.\n'
  );

  const stats = {
    cleaned: 0,
    skipped: 0,
    errors: 0,
  };

  const startTime = Date.now();
  let skip = 0;
  let hasMore = true;
  let batchNumber = 1;

  while (hasMore) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(
      `🧹 Batch ${batchNumber} | Cleaned: ${stats.cleaned} | Skipped: ${stats.skipped}`
    );
    console.log('='.repeat(60));

    hasMore = await cleanHistoryBatch(skip, batchSize, stats);
    skip += batchSize;
    batchNumber++;

    // Memory cleanup
    if (global.gc) {
      global.gc();
    }
  }

  const totalElapsed = (Date.now() - startTime) / 1000;

  console.log('\n' + '='.repeat(60));
  console.log('✅ Cleanup completed!');
  console.log('='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Documents cleaned: ${stats.cleaned}`);
  console.log(`   Documents skipped (not migrated): ${stats.skipped}`);
  console.log(`   Errors encountered: ${stats.errors}`);
  console.log(`\n⏱️  Performance:`);
  console.log(`   Total time: ${totalElapsed.toFixed(1)}s`);
  console.log(
    `   Average rate: ${(stats.cleaned / totalElapsed).toFixed(2)} docs/sec\n`
  );

  // Verify cleanup
  const remainingHistory = await prisma.document.count({
    where: {
      meta: {
        path: ['history'],
        not: Prisma.DbNull,
      },
    },
  });

  console.log(`📊 Post-cleanup Status:`);
  console.log(`   Documents still with meta.history: ${remainingHistory}`);

  if (remainingHistory > 0) {
    console.log(`   (These documents were not migrated yet)\n`);
  } else {
    console.log(`   ✅ All meta.history fields have been cleaned!\n`);
  }
}

async function migrateDocumentHistory() {
  const options = parseArgs();

  // If only cleaning history, run cleanup and exit
  if (options.cleanHistory && options.skip === 0 && !options.limit) {
    await cleanMetaHistory(options.cleanBatchSize);
    return;
  }

  console.log('🚀 Starting document history migration...');
  console.log(`⚙️  Configuration:`);
  console.log(`   - Batch size: ${options.batchSize} documents`);
  console.log(`   - Skip: ${options.skip} documents`);
  console.log(`   - Limit: ${options.limit || 'unlimited'} documents`);
  console.log(
    `   - Clean history after migration: ${
      options.cleanHistory ? 'Yes' : 'No'
    }\n`
  );

  const stats: MigrationStats = {
    totalDocuments: 0,
    processedCount: 0,
    migratedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    totalHistoryEntries: 0,
    startTime: new Date(),
  };

  try {
    // Get total count for progress tracking
    const totalCount = await prisma.document.count({
      where: {
        meta: {
          path: ['history'],
          not: Prisma.DbNull,
        },
      },
    });
    stats.totalDocuments = totalCount;
    console.log(`📊 Found ${totalCount} documents with history in metadata\n`);

    let skip = options.skip;
    let hasMore = true;
    let batchNumber = 1;

    while (hasMore) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Batch ${batchNumber} | Progress: ${skip}/${totalCount}`);
      console.log('='.repeat(60));

      hasMore = await processBatch(skip, options.batchSize, stats);
      skip += options.batchSize;
      batchNumber++;

      // Check if we've hit the limit
      if (options.limit && stats.processedCount >= options.limit) {
        console.log(`\n⚠️  Reached limit of ${options.limit} documents`);
        break;
      }

      // Memory cleanup between batches
      if (global.gc) {
        global.gc();
      }
    }

    const totalElapsed = (Date.now() - stats.startTime.getTime()) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed!');
    console.log('='.repeat(60));
    console.log('📊 Final Summary:');
    console.log(`   Total documents in DB: ${stats.totalDocuments}`);
    console.log(`   Documents processed: ${stats.processedCount}`);
    console.log(`   Documents migrated: ${stats.migratedCount}`);
    console.log(`   Documents skipped: ${stats.skippedCount}`);
    console.log(`   Errors encountered: ${stats.errorCount}`);
    console.log(
      `   Total history entries created: ${stats.totalHistoryEntries}`
    );
    console.log(`\n⏱️  Performance:`);
    console.log(`   Total time: ${totalElapsed.toFixed(1)}s`);
    console.log(
      `   Average rate: ${(stats.processedCount / totalElapsed).toFixed(
        2
      )} docs/sec`
    );
    if (!options.cleanHistory) {
      console.log(
        '\n💡 Note: Original meta.history data is preserved for safety.'
      );
      console.log('   You can remove it after verifying the migration with:');
      console.log(
        '   npx ts-node server/scripts/migrateDocumentHistory.ts --clean-history'
      );
      console.log('   To resume from a specific point, use: --skip=N\n');
    }

    // If clean-history flag is set, run cleanup after migration
    if (options.cleanHistory) {
      console.log('\n' + '='.repeat(60));
      console.log('🧹 Starting cleanup of meta.history fields...');
      console.log('='.repeat(60));
      await cleanMetaHistory(options.cleanBatchSize);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  migrateDocumentHistory()
    .then(() => {
      console.log('🎉 Migration script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateDocumentHistory };
