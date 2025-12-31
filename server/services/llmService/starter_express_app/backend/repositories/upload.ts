import { db } from '../db';
import { uploads, InsertUpload } from '../db/schema';
import { eq } from 'drizzle-orm';

export class UploadRepository {
  async create(uploadData: InsertUpload) {
    const [upload] = await db.insert(uploads).values(uploadData).returning();

    return upload;
  }

  async findById(id: string) {
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, id));

    return upload;
  }

  async updateStatus(id: string, status: string) {
    const [upload] = await db
      .update(uploads)
      .set({ status, updatedAt: new Date() })
      .where(eq(uploads.id, id))
      .returning();

    return upload;
  }

  async delete(id: string) {
    await db.delete(uploads).where(eq(uploads.id, id));
  }
}

export const uploadRepository = new UploadRepository();
