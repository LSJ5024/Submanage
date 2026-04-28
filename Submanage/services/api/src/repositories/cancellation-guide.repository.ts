import { prisma } from '../lib/prisma.js';

interface GuideData {
  catalogId: string;
  steps: { order: number; description: string; imageUrl?: string }[];
  deepLink?: string;
  screenshotUrls?: string[];
}

/** CancellationGuideRepository — DB 쿼리만 담당 (비즈니스 로직 금지, CLAUDE.md §4) */
export class CancellationGuideRepository {
  async create(data: GuideData) {
    return prisma.cancellationGuide.create({
      data: {
        catalog_id:      data.catalogId,
        steps:           data.steps,
        deep_link:       data.deepLink ?? null,
        screenshot_urls: data.screenshotUrls ?? [],
      },
    });
  }

  async update(id: string, data: Partial<Omit<GuideData, 'catalogId'>>) {
    return prisma.cancellationGuide.update({
      where: { id },
      data: {
        ...(data.steps           !== undefined && { steps:           data.steps }),
        ...(data.deepLink        !== undefined && { deep_link:       data.deepLink }),
        ...(data.screenshotUrls  !== undefined && { screenshot_urls: data.screenshotUrls }),
      },
    });
  }

  async findAll() {
    return prisma.cancellationGuide.findMany({
      include: { catalog: { select: { service_name: true, category: true } } },
      orderBy: { updated_at: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.cancellationGuide.findUnique({ where: { id } });
  }
}
