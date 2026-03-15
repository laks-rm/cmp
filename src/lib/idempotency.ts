import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

const IDEMPOTENCY_TTL_DAYS = 1;

export async function checkIdempotency(
  key: string,
  userId: string
): Promise<{ exists: boolean; response?: unknown }> {
  try {
    const record = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!record) {
      return { exists: false };
    }

    // Check if expired
    if (record.expiresAt < new Date()) {
      // Clean up expired record
      await prisma.idempotencyKey.delete({
        where: { key },
      }).catch(() => {
        // Ignore deletion errors
      });
      return { exists: false };
    }

    // Verify user matches
    if (record.userId !== userId) {
      throw new Error("Idempotency key belongs to different user");
    }

    return {
      exists: true,
      response: record.response,
    };
  } catch (error) {
    console.error("Error checking idempotency:", error);
    throw error;
  }
}

export async function storeIdempotency(
  key: string,
  userId: string,
  response: unknown
): Promise<void> {
  try {
    const expiresAt = addDays(new Date(), IDEMPOTENCY_TTL_DAYS);

    await prisma.idempotencyKey.create({
      data: {
        key,
        userId,
        response: response as never,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Error storing idempotency key:", error);
  }
}

export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error("Error cleaning up expired idempotency keys:", error);
    return 0;
  }
}
