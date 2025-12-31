import { HumanMessage } from '@langchain/core/messages';

export class CacheBlockManager {
  private usedBlocks: number = 0;
  private readonly maxBlocks: number = 4;
  private readonly CACHE_IT_THRESHOLD: number = 128;
  private readonly systemMessageCached: boolean;
  private cacheStrategy: 'sequential' | 'strategic' = 'strategic';
  private accumulatedUncachedLength: number = 0;
  private lastRedistributionLength: number = 0;

  constructor(systemMessageCached: boolean = true) {
    this.systemMessageCached = systemMessageCached;
    this.usedBlocks = systemMessageCached ? 2 : 0;
  }

  getThreshold(): number {
    return this.CACHE_IT_THRESHOLD;
  }

  canAddBlock(): boolean {
    return this.usedBlocks < this.maxBlocks;
  }

  getRemainingBlocks(): number {
    return this.maxBlocks - this.usedBlocks;
  }

  addBlock(): void {
    if (this.canAddBlock()) {
      this.usedBlocks++;
    }
  }

  reduceBlock(number: number): void {
    this.usedBlocks -= number;
  }

  reset(keepSystemCache: boolean = true): void {
    this.usedBlocks = keepSystemCache && this.systemMessageCached ? 2 : 0;
    this.accumulatedUncachedLength = 0;
  }

  addUncachedLength(length: number): void {
    this.accumulatedUncachedLength += length;
  }

  resetAccumulatedLength(): void {
    this.accumulatedUncachedLength = 0;
  }

  getAccumulatedLength(): number {
    return this.accumulatedUncachedLength;
  }

  setLastRedistributionLength(length: number): void {
    this.lastRedistributionLength = length;
  }

  getLastRedistributionLength(): number {
    return this.lastRedistributionLength;
  }

  needsRedistribution(totalLength: number): boolean {
    return (
      this.getRemainingBlocks() < 1 &&
      (this.accumulatedUncachedLength > this.CACHE_IT_THRESHOLD || // output messages are not counted in accumulatedUncachedLength
        Math.abs(totalLength - this.lastRedistributionLength) >
          this.CACHE_IT_THRESHOLD)
    );
  }

  // Strategic cache allocation based on content importance
  shouldCacheMessage(
    messageIndex: number,
    messageLength: number,
    totalMessages: number
  ): boolean {
    if (!this.canAddBlock() || messageIndex < 2) return false;
    return true;
  }

  // Add message with smart caching logic
  addMessageWithSmartCaching(messages: any[], message: any): void {
    const messageLength = this.getMessageLength(message);
    const shouldCache = this.shouldCacheMessage(
      messages.length,
      messageLength,
      messages.length + 1
    );

    if (shouldCache && this.addCacheControlToMessage(message)) {
      this.addBlock();
      this.resetAccumulatedLength();
    } else {
      this.addUncachedLength(messageLength);
    }

    messages.push(message);
  }

  findCachedMessageIndices(messages: any[], startIndex: number = 1): number[] {
    const cachedIndices: number[] = [];

    for (let i = startIndex; i < messages.length; i++) {
      const content = messages[i].content;
      if (Array.isArray(content)) {
        const hasCacheControl = content.some((item) => 'cache_control' in item);
        if (hasCacheControl) {
          cachedIndices.push(i);
        }
      }
    }

    return cachedIndices;
  }

  // Redistribute cache blocks if needed
  async redistributeCacheIfNeeded(messages: any[]): Promise<void> {
    const totalLength = this.calculateTotalMessageLength(messages);

    if (!this.needsRedistribution(totalLength)) {
      return;
    }

    console.log('Redistributing cache blocks...');

    // Find all currently cached message indices (excluding system message)
    const cachedIndices = this.findCachedMessageIndices(messages, 1);

    if (cachedIndices.length <= 2) {
      console.log('no cached messages to merge, just cache the last message');
      // No cached messages to merge, just cache the last message
      if (this.addCacheControlToMessage(messages[messages.length - 1])) {
        this.addBlock();
        this.setLastRedistributionLength(totalLength);
      }
      return;
    }

    // Calculate cache block sizes
    const cacheBlocks = this.calculateCacheBlockSizes(messages, cachedIndices);

    // Find the smallest cache block
    const smallestBlockIndex = this.findSmallestCacheBlock(cacheBlocks);

    if (smallestBlockIndex !== -1 && smallestBlockIndex >= 0) {
      // Merge smallest block with the previous block
      console.log('merging with previous block at index: ', smallestBlockIndex);
      this.mergeWithPreviousBlock(messages, cachedIndices, smallestBlockIndex);
      // Always ensure the last message has a cache tag
      if (this.getRemainingBlocks() > 0) {
        console.log('ensure last message cached');
        this.ensureLastMessageCached(messages);
        this.resetAccumulatedLength();
        this.setLastRedistributionLength(totalLength);
      }
    }
  }

  // Private utility methods
  private getMessageLength(message: any): number {
    if (typeof message.content === 'string') {
      return message.content.length;
    }
    if (Array.isArray(message.content)) {
      return message.content.reduce(
        (sum: number, item: any) =>
          // why item.conent
          sum + (item.text?.length || item.content?.length || 0),
        0
      );
    }
    return 0;
  }

  private addCacheControlToMessage(message: any): boolean {
    if (Array.isArray(message.content) && message.content.length > 0) {
      const lastItem = message.content[message.content.length - 1];
      lastItem.cache_control = { type: 'ephemeral' };
      return true; // need to confirm the cache tag is added to the last item of the message
    }
    return false; // message.content.length might be 0
  }

  private clearExistingCacheTags(
    messages: any[],
    startIndex: number = 1
  ): void {
    for (let i = startIndex; i < messages.length; i++) {
      const content = messages[i].content;
      if (Array.isArray(content)) {
        content.forEach((item) => {
          if ('cache_control' in item) {
            delete item.cache_control;
          }
        });
      }
    }
  }

  private calculateTotalMessageLength(messages: any[]): number {
    return messages.reduce(
      (total, msg) => total + this.getMessageLength(msg),
      0
    );
  }

  private calculateCacheBlockSizes(
    messages: any[],
    cachedIndices: number[]
  ): { index: number; startMsg: number; endMsg: number; size: number }[] {
    const blocks: {
      index: number;
      startMsg: number;
      endMsg: number;
      size: number;
    }[] = [];

    for (let i = 0; i < cachedIndices.length; i++) {
      const startMsg = i === 0 ? 1 : cachedIndices[i - 1] + 1; // Start after previous cache or after system message
      const endMsg = cachedIndices[i];

      let size = 0;
      for (let msgIndex = startMsg; msgIndex <= endMsg; msgIndex++) {
        size += this.getMessageLength(messages[msgIndex]);
      }

      blocks.push({
        index: i,
        startMsg,
        endMsg,
        size,
      });
    }

    return blocks;
  }

  private findSmallestCacheBlock(
    blocks: { index: number; startMsg: number; endMsg: number; size: number }[]
  ): number {
    if (blocks.length === 0) return -1;

    let smallestIndex = 0;
    let smallestSize = blocks[0].size;

    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i].size < smallestSize) {
        smallestSize = blocks[i].size;
        smallestIndex = i;
      }
    }

    return smallestIndex;
  }

  private mergeWithPreviousBlock(
    messages: any[],
    cachedIndices: number[],
    smallestBlockIndex: number
  ): void {
    // Remove cache control from the smallest block
    const smallestCacheIndex = cachedIndices[smallestBlockIndex];
    this.removeCacheControlFromMessage(messages[smallestCacheIndex]);

    // The merge happens automatically since the previous block's cache will now include
    // the content from the smallest block (cache blocks work by caching everything up to the cache point)
  }

  private removeCacheControlFromMessage(message: any): void {
    if (Array.isArray(message.content)) {
      message.content.forEach((item: any) => {
        if ('cache_control' in item) {
          delete item.cache_control;
        }
      });
      this.usedBlocks--;
    }
  }

  private ensureLastMessageCached(messages: any[]): void {
    const isCached = this.addCacheControlToMessage(
      messages[messages.length - 1]
    );
    if (isCached) {
      this.usedBlocks++;
    } else {
      console.log('The last message was not cached for some reason');
    }
  }

  private updateBlockCountAfterMerge(): void {
    // After merging, we have one less block but we ensure the last message is cached
    // The actual count should be recalculated based on remaining cache tags
    // For simplicity, we'll decrement by 1 (due to merge) but this could be more sophisticated
    if (this.usedBlocks > 1) {
      this.usedBlocks--;
    }
  }

  private identifyImportantMessages(messages: any[]): number[] {
    const important: number[] = [];
    const availableBlocks = 2; // Reserve 1 block for new content

    // Prioritize: recent large messages, error messages, tool outputs
    const candidates = messages
      .map((msg, index) => ({
        index,
        length: this.getMessageLength(msg),
        isRecent: index >= messages.length - 10,
        isError:
          msg.content?.includes?.('error') || msg.content?.includes?.('Error'),
        isToolOutput: msg.role === 'tool',
      }))
      .filter((candidate) => candidate.index > 0) // Skip system message
      .sort((a, b) => {
        // Prioritize recent, large, error, and tool messages
        const scoreA =
          (a.isRecent ? 100 : 0) +
          (a.isError ? 50 : 0) +
          (a.isToolOutput ? 30 : 0) +
          Math.min(a.length / 100, 20);
        const scoreB =
          (b.isRecent ? 100 : 0) +
          (b.isError ? 50 : 0) +
          (b.isToolOutput ? 30 : 0) +
          Math.min(b.length / 100, 20);
        return scoreB - scoreA;
      });

    return candidates.slice(0, availableBlocks).map((c) => c.index);
  }

  // Emergency token limit handling - aggressively reduce context
  handleTokenLimit(messages: any[]): void {
    console.log(
      'Emergency token limit handling: aggressively reducing context'
    );

    if (messages.length > 1) {
      // Keep the system message
      const systemMessage = messages[0];

      // Find the latest human message in the message history
      let latestHumanMessage = null;
      for (let i = messages.length - 1; i > 0; i--) {
        if (
          messages[i]._getType() === 'human' ||
          messages[i].constructor.name === 'HumanMessage'
        ) {
          latestHumanMessage = messages[i];
          break;
        }
      }

      if (latestHumanMessage) {
        // Get the content of the latest human message
        let originalContent = '';
        if (typeof latestHumanMessage.content === 'string') {
          originalContent = latestHumanMessage.content;
        } else if (Array.isArray(latestHumanMessage.content)) {
          // Handle array content (e.g., text + image)
          originalContent = latestHumanMessage.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join(' ');
        }

        // Truncate to 60% of original length and append "(truncated)"
        const truncatedContent =
          originalContent.length > 100
            ? originalContent.substring(
                0,
                Math.floor(originalContent.length * 0.6)
              ) + ' (truncated due to token limit)'
            : originalContent;

        // Create new human message with truncated content
        const truncatedHumanMessage = new HumanMessage({
          content: truncatedContent,
        });

        // Set the new messages array with just system message and truncated human message
        messages.length = 0;
        messages.push(systemMessage, truncatedHumanMessage);

        // Reset cache blocks
        this.usedBlocks = this.systemMessageCached ? 2 : 0;
        this.accumulatedUncachedLength = 0;

        console.log(
          `Reduced human message from ${originalContent.length} to ${truncatedContent.length} chars`
        );
      } else {
        // Fallback: keep system message only
        messages.length = 0;
        messages.push(systemMessage);
        this.usedBlocks = this.systemMessageCached ? 2 : 0;
        this.accumulatedUncachedLength = 0;
      }
    }
  }
}
