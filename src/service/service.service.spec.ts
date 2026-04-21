import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ServiceService } from './service.service';
import { Service } from './service.schema';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockService = {
  _id: new Types.ObjectId(),
  nom: 'Diabetology',
  description: 'Diabetology services specialize in managing chronic diabetes, diabetic foot care, and endocrinopathies like Cushing’s syndrome, often providing both inpatient care for stabilization and outpatient consultations.',
  localisation: 'Bâtiment A, RDC',
  type: 'Médical',
  telephone: '+216 71 000 000',
  email: 'diabetology@hopital.tn',
  capacite: 50,
  statut: 'ACTIF',
  tempsAttenteMoyen: 15,
  estUrgence: false,
  horaires: [{ jour: 'Lundi', ouverture: '08:00', fermeture: '18:00' }],
  responsableId: 'resp-456',
  deletedAt: null,
};

const mockServiceModel = {
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('ServiceService', () => {
  let service: ServiceService;
  let model: Model<Service>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceService,
        {
          provide: getModelToken(Service.name),
          useValue: mockServiceModel,
        },
      ],
    }).compile();

    service = module.get<ServiceService>(ServiceService);
    model = module.get<Model<Service>>(getModelToken(Service.name));

    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('devrait créer un service et le retourner', async () => {
      const dto: CreateServiceDto = {
        nom: 'Urgences',
        description: 'Service des urgences',
        localisation: 'Bâtiment A, RDC',
        type: 'Médical',
        telephone: '+216 71 000 000',
        email: 'urgences@hopital.tn',
        capacite: 50,
        statut: 'ACTIF',
        tempsAttenteMoyen: 15,
        estUrgence: true,
        horaires: [{ jour: 'Lundi', ouverture: '08:00', fermeture: '18:00' }],
        responsableId: 'resp-456',
      };

      mockServiceModel.create.mockResolvedValue(mockService);

      const result = await service.create(dto);

      expect(mockServiceModel.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockService);
    });

    it('devrait créer un service avec les champs minimaux requis', async () => {
      const dto: CreateServiceDto = { nom: 'Cardiologie' } as CreateServiceDto;
      const created = { _id: 'new-id', nom: 'Cardiologie', statut: 'ACTIF' };

      mockServiceModel.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result.nom).toBe('Cardiologie');
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────
describe('findAll()', () => {
  it('devrait retourner tous les services non supprimés', async () => {
    const services = [mockService, { ...mockService, _id: new Types.ObjectId(), nom: 'Chirurgie' }];

    mockServiceModel.find.mockResolvedValue(services);

    const result = await service.findAll();

    expect(mockServiceModel.find).toHaveBeenCalledWith({ deletedAt: null });
    expect(result).toHaveLength(2);
  });

  it('devrait retourner un tableau vide si aucun service', async () => {
    mockServiceModel.find.mockResolvedValue([]);

    const result = await service.findAll();

    expect(result).toEqual([]);
  });
});

  // ── findOne ─────────────────────────────────────────────────────────────

  describe('findOne()', () => {
  it('devrait retourner un service par son id', async () => {
    mockServiceModel.findById.mockResolvedValue(mockService);

    const result = await service.findOne(mockService._id.toString());

    expect(mockServiceModel.findById).toHaveBeenCalledWith(mockService._id.toString());
    expect(result).toEqual(mockService);
  });

  it('devrait lever NotFoundException si le service est introuvable', async () => {
    mockServiceModel.findById.mockResolvedValue(null);

    await expect(service.findOne('69ccee00c60a1f830c854566')).rejects.toThrow(NotFoundException);
  });

  it('devrait lever NotFoundException si le service est soft-deleted', async () => {
    const deleted = { ...mockService, deletedAt: new Date() };
    mockServiceModel.findById.mockResolvedValue(deleted);

    await expect(service.findOne(mockService._id.toString())).rejects.toThrow(NotFoundException);
  });
});
  // ── update ──────────────────────────────────────────────────────────────

 describe('update()', () => {
  it('devrait mettre à jour et retourner le service modifié', async () => {
    const dto: UpdateServiceDto = { 
      nom: 'Oncology',
      description: 'Unit specializing in the diagnosis and treatment of cancer, including chemotherapy, radiation therapy, and palliative care for patients with malignant tumors.',
      capacite: 45,
    };
    const updated = { ...mockService, ...dto };

    mockServiceModel.findByIdAndUpdate.mockResolvedValue(updated);

    const result = await service.update(mockService._id.toString(), dto);

    expect(mockServiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockService._id.toString(),
      dto,
      { new: true },
    );
    expect(result.nom).toBe('Oncology');
    expect(result.capacite).toBe(45);
  });

  it('devrait lever NotFoundException si le service est introuvable', async () => {
    mockServiceModel.findByIdAndUpdate.mockResolvedValue(null);

    await expect(
      service.update('69becfc10f9af5763c487cc8', {}),
    ).rejects.toThrow(NotFoundException);
  });
});

  // ── remove (soft delete) ─────────────────────────────────────────────────

describe('remove()', () => {
  it('devrait effectuer un soft-delete (définir deletedAt)', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const serviceWithSave = { ...mockService, deletedAt: null, save: saveMock };

    mockServiceModel.findById.mockResolvedValue(serviceWithSave);

    await service.remove(mockService._id.toString());

    expect(mockServiceModel.findById).toHaveBeenCalledWith(mockService._id.toString());
    expect(saveMock).toHaveBeenCalled();
    expect(serviceWithSave.deletedAt).toBeDefined();
  });

  it('devrait lever NotFoundException si le service est introuvable', async () => {
    mockServiceModel.findById.mockResolvedValue(null);

    await expect(service.remove('69becfc10f9af5763c487cc8')).rejects.toThrow(NotFoundException);
  });
});

  // ── activate ─────────────────────────────────────────────────────────────

 describe('activate()', () => {
  it('devrait passer le statut du service à ACTIF', async () => {
    const activated = { ...mockService, statut: 'ACTIF' };

    mockServiceModel.findByIdAndUpdate.mockResolvedValue(activated);

    const result = await service.activate(mockService._id.toString());

    expect(mockServiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockService._id.toString(),
      { statut: 'ACTIF' },
      { new: true },
    );
    expect(result.statut).toBe('ACTIF');
  });

  it('devrait lever NotFoundException si le service est introuvable', async () => {
    mockServiceModel.findByIdAndUpdate.mockResolvedValue(null);

    await expect(
      service.activate('507f1f77bcf86cd799439011'),
    ).rejects.toThrow(NotFoundException);
  });
});



  // ── deactivate ───────────────────────────────────────────────────────────

 describe('deactivate()', () => {
  it('devrait passer le statut du service à INACTIF', async () => {
    const deactivated = { ...mockService, statut: 'INACTIF' };

    mockServiceModel.findByIdAndUpdate.mockResolvedValue(deactivated);

    const result = await service.deactivate(mockService._id.toString());

    expect(mockServiceModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockService._id.toString(),
      { statut: 'INACTIF' },
      { new: true },
    );
    expect(result.statut).toBe('INACTIF');
  });

  it('devrait lever NotFoundException si le service est introuvable', async () => {
    mockServiceModel.findByIdAndUpdate.mockResolvedValue(null);

    await expect(
      service.deactivate('507f1f77bcf86cd799439011'),
    ).rejects.toThrow(NotFoundException);
  });
});
});