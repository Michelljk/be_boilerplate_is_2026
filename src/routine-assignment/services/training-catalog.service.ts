import { Injectable } from '@nestjs/common';
import { TrainingCatalogRepository } from '../repositories/training-catalog.repository.js';

/**
 * Catálogo de ejercicios para armar rutinas (H22).
 *
 * El listado de clientes asignados vive en el dominio de progreso (H26): dos
 * controladores no pueden prometer la misma ruta con formas distintas.
 */
@Injectable()
export class TrainingCatalogService {
  constructor(private readonly repository: TrainingCatalogRepository) {}

  exercises(page: number, pageSize: number) {
    return this.repository.exercises(page, pageSize);
  }
}
