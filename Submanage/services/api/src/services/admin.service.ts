import { CancellationGuideRepository } from '../repositories/cancellation-guide.repository.js';
import { NotFoundError } from '../common/errors.js';

interface GuideInput {
  catalogId: string;
  steps: { order: number; description: string; imageUrl?: string }[];
  deepLink?: string;
  screenshotUrls?: string[];
}

/** AdminService — 해지 가이드 CMS 비즈니스 로직 (TASK-024) */
export class AdminService {
  private readonly guideRepo = new CancellationGuideRepository();

  async createGuide(input: GuideInput) {
    return this.guideRepo.create(input);
  }

  async updateGuide(id: string, input: Partial<Omit<GuideInput, 'catalogId'>>) {
    const existing = await this.guideRepo.findById(id);
    if (!existing) throw new NotFoundError('해당 해지 가이드를 찾을 수 없습니다.');
    return this.guideRepo.update(id, input);
  }

  async listGuides() {
    return this.guideRepo.findAll();
  }
}
