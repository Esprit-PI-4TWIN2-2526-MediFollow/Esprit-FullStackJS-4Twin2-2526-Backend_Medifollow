import { Test, TestingModule } from '@nestjs/testing';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOCK_ID = new Types.ObjectId();
const UNKNOWN_ID = '507f1f77bcf86cd799439011';

const mockService = {
  _id: MOCK_ID,
  nom: 'Diabetology',
  description:
    'Diabetology services specialize in managing chronic diabetes, diabetic foot care, and endocrinopathies like Cushing syndrome, often providing both inpatient care for stabilization and outpatient consultations.',
  statut: 'ACTIF',
  estUrgence: false,
  deletedAt: null,
};

const mockServiceService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  activate: jest.fn(),
  deactivate: jest.fn(),
};

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('ServiceController', () => {
  let controller: ServiceController;
  let serviceService: ServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceController],
      providers: [{ provide: ServiceService, useValue: mockServiceService }],
    }).compile();

    controller = module.get<ServiceController>(ServiceController);
    serviceService = module.get<ServiceService>(ServiceService);

    jest.clearAllMocks();
  });

  // ── POST /services ───────────────────────────────────────────────────────

  describe('create()', () => {
    it('devrait appeler serviceService.create() et retourner le service créé', async () => {
      const dto: CreateServiceDto = {
        nom: 'Diabetology',
        estUrgence: false,
      } as CreateServiceDto;

      mockServiceService.create.mockResolvedValue(mockService);

      const result = await controller.create(dto);

      expect(serviceService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockService);
    });
  });

  // ── GET /services ────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('devrait retourner la liste de tous les services', async () => {
      const services = [
        mockService,
        { ...mockService, _id: new Types.ObjectId(), nom: 'Oncology' },
      ];
      mockServiceService.findAll.mockResolvedValue(services);

      const result = await controller.findAll();

      expect(serviceService.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('devrait retourner un tableau vide si aucun service', async () => {
      mockServiceService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── GET /services/:id ────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('devrait retourner un service par son id', async () => {
      mockServiceService.findOne.mockResolvedValue(mockService);

      const result = await controller.findOne(MOCK_ID.toString());

      expect(serviceService.findOne).toHaveBeenCalledWith(MOCK_ID.toString());
      expect(result).toEqual(mockService);
    });

    it('devrait propager NotFoundException si le service est introuvable', async () => {
      mockServiceService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(UNKNOWN_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /services/:id ────────────────────────────────────────────────────

  describe('update()', () => {
    it('devrait mettre à jour et retourner le service modifié', async () => {
      const dto: UpdateServiceDto = {
        nom: 'Oncology',
        description:
          'Unit specializing in the diagnosis and treatment of cancer, including chemotherapy, radiation therapy, and palliative care.',
        capacite: 45,
      };
      const updated = { ...mockService, ...dto };

      mockServiceService.update.mockResolvedValue(updated);

      const result = await controller.update(MOCK_ID.toString(), dto);

      expect(serviceService.update).toHaveBeenCalledWith(MOCK_ID.toString(), dto);
      expect(result.nom).toBe('Oncology');
    });

    it('devrait propager NotFoundException si le service est introuvable', async () => {
      mockServiceService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(UNKNOWN_ID, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── DELETE /services/:id ─────────────────────────────────────────────────

  describe('remove()', () => {
    it('devrait supprimer (soft-delete) le service sans retourner de valeur', async () => {
      // ✅ remove() retourne void dans le service
      mockServiceService.remove.mockResolvedValue(undefined);

      await controller.remove(MOCK_ID.toString());

      expect(serviceService.remove).toHaveBeenCalledWith(MOCK_ID.toString());
    });

    it('devrait propager NotFoundException si le service est introuvable', async () => {
      mockServiceService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(UNKNOWN_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /services/:id/activate ───────────────────────────────────────────

  describe('activate()', () => {
    it('devrait activer le service et retourner statut ACTIF', async () => {
      const activated = { ...mockService, statut: 'ACTIF' };
      mockServiceService.activate.mockResolvedValue(activated);

      const result = await controller.activate(MOCK_ID.toString());

      expect(serviceService.activate).toHaveBeenCalledWith(MOCK_ID.toString());
      expect(result.statut).toBe('ACTIF');
    });

    it('devrait propager NotFoundException si le service est introuvable', async () => {
      mockServiceService.activate.mockRejectedValue(new NotFoundException());

      await expect(controller.activate(UNKNOWN_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /services/:id/deactivate ─────────────────────────────────────────

  describe('deactivate()', () => {
    it('devrait désactiver le service et retourner statut INACTIF', async () => {
      const deactivated = { ...mockService, statut: 'INACTIF' };
      mockServiceService.deactivate.mockResolvedValue(deactivated);

      const result = await controller.deactivate(MOCK_ID.toString());

      expect(serviceService.deactivate).toHaveBeenCalledWith(MOCK_ID.toString());
      expect(result.statut).toBe('INACTIF');
    });

    it('devrait propager NotFoundException si le service est introuvable', async () => {
      mockServiceService.deactivate.mockRejectedValue(new NotFoundException());

      await expect(controller.deactivate(UNKNOWN_ID)).rejects.toThrow(NotFoundException);
    });
  });
});