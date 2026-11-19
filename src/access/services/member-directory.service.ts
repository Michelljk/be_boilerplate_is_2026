import { Injectable } from '@nestjs/common';
import { DomainError } from '@Common/errors';
import {
  MemberRepository,
  type MemberDirectoryCandidate,
} from '../repositories/member.repository.js';

@Injectable()
export class MemberDirectoryService {
  constructor(private readonly members: MemberRepository) {}

  async search(term: string): Promise<MemberDirectoryCandidate[]> {
    const search = term.trim();
    if (search.length < 2 || search.length > 60) {
      throw new DomainError(
        'INVALID',
        'La búsqueda debe tener entre 2 y 60 caracteres.',
      );
    }

    return this.members.searchDirectory(search);
  }
}
