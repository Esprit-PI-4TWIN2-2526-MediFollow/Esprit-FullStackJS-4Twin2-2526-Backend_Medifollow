export interface Horaire {
  jour: string;
  ouverture: string;
  fermeture: string;
}
 
export interface GeneratedService {
  nom: string;
  description: string;
  type: string;
  localisation: string;
  telephone: string;
  email: string;
  capacite: number;
  tempsAttenteMoyen: number;
  estUrgence: boolean;
  statut: 'ACTIF' | 'INACTIF';
  horaires: Horaire[];
  responsableId: string;
}
