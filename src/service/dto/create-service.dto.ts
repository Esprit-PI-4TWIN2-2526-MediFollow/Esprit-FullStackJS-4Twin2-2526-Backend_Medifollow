import {
    IsString,
    IsNumber,
    IsBoolean,
    IsArray,
    IsOptional,
    IsEnum,
} from 'class-validator';

export class CreateServiceDto {
    @IsString()
    nom: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsString()
    localisation: string;

    @IsString()
    type: string;

    @IsString()
    telephone: string;

    @IsString()
    email: string;

    @IsNumber()
    capacite: number;

    @IsEnum(['ACTIF', 'INACTIF'])
    statut: string;

    @IsNumber()
    tempsAttenteMoyen: number;

    @IsBoolean()
    estUrgence: boolean;

    @IsArray()
    horaires: {
        jour: string;
        ouverture: string;
        fermeture: string;
    }[];

    @IsString()
    responsableId: string;
}
