import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import Groq from 'groq-sdk';
import { GeneratedService } from './generated-service.interface';

@Injectable()
export class AiGeneratorService {

  private client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  async generateService(description: string): Promise<GeneratedService> {
    if (!description?.trim()) {
      throw new BadRequestException('La description est requise');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant médical expert dans les hôpitaux tunisiens.
Ta mission : générer une fiche complète de service hospitalier en JSON.
RÈGLE ABSOLUE : Tu dois TOUJOURS remplir TOUS les champs du JSON.
Si une information n'est pas mentionnée, tu l'INVENTES de façon réaliste et cohérente avec le type de service.
Tu ne laisses JAMAIS un champ vide, null, ou avec une valeur par défaut générique.
Tu retournes UNIQUEMENT du JSON brut, sans texte avant ou après, sans balises markdown.`,
          },
          {
            role: 'user',
            content: `Génère une fiche complète pour ce service médical : "${description}"

IMPORTANT : Tu dois inventer et remplir TOUS les champs de façon réaliste, même si non mentionnés.

Retourne ce JSON complètement rempli :
{
  "nom": "Nom précis et professionnel du service (ex: Service de Cardiologie, Unité des Urgences Pédiatriques)",
  "description": "Description professionnelle complète du service en 2-3 phrases",
  "type": "OBLIGATOIRE — exactement un parmi: Médical, Urgence, Consultation, Chirurgie, Laboratoire, Radiologie, Pharmacie, Administratif",
  "localisation": "Localisation précise inventée si non mentionnée (ex: Bâtiment B - 2ème étage, Aile Nord)",
  "telephone": "Numéro tunisien réaliste OBLIGATOIRE (ex: +216 71 234 567, +216 70 123 456)",
  "email": "Email professionnel OBLIGATOIRE basé sur le nom du service (ex: cardiologie@hopital-charles-nicolle.tn)",
  "capacite": "Nombre entier réaliste selon le type — JAMAIS 0 (Urgence: 15-30, Consultation: 10-20, Chirurgie: 5-15, Labo: 50-100, autres: 10-30)",
  "tempsAttenteMoyen": "Nombre entier réaliste en minutes (Urgence: 10-20, Consultation: 20-45, Labo: 45-90, Radio: 30-60, autres: 15-30)",
  "estUrgence": "true UNIQUEMENT si urgence/urgences/urgente dans la description, sinon false",
  "statut": "ACTIF",
  "horaires": [
    "Génère les jours appropriés selon le type :",
    "- Urgence/24h : 7 jours avec ouverture 00:00 fermeture 23:59",
    "- Consultation/Médical : Lundi-Vendredi 08:00-17:00",
    "- Laboratoire/Radiologie : Lundi-Samedi 07:30-15:30",
    "- Pharmacie : tous les jours 08:00-20:00",
    "- Chirurgie : Lundi-Vendredi 07:00-16:00"
  ],
  "responsableId": ""
}

Exemple de sortie attendue pour "service de cardiologie" :
{
  "nom": "Service de Cardiologie",
  "description": "Service spécialisé dans le diagnostic et le traitement des maladies cardiovasculaires. Dispose d'équipements modernes d'imagerie cardiaque et d'une équipe de cardiologues expérimentés.",
  "type": "Médical",
  "localisation": "Bâtiment Principal - 3ème étage, Aile Est",
  "telephone": "+216 71 578 234",
  "email": "cardiologie@hopital-rabta.tn",
  "capacite": 25,
  "tempsAttenteMoyen": 35,
  "estUrgence": false,
  "statut": "ACTIF",
  "horaires": [
    {"jour": "Lundi",    "ouverture": "08:00", "fermeture": "17:00"},
    {"jour": "Mardi",    "ouverture": "08:00", "fermeture": "17:00"},
    {"jour": "Mercredi", "ouverture": "08:00", "fermeture": "17:00"},
    {"jour": "Jeudi",    "ouverture": "08:00", "fermeture": "17:00"},
    {"jour": "Vendredi", "ouverture": "08:00", "fermeture": "17:00"}
  ],
  "responsableId": ""
}

Maintenant génère pour : "${description}"`,
          },
        ],
        temperature: 0.4, // un peu plus créatif pour inventer des données réalistes
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';

      if (!raw) {
        throw new InternalServerErrorException('Réponse vide du modèle');
      }

      // Extraction robuste du JSON
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new SyntaxError('Aucun JSON trouvé dans la réponse');
      }

      const parsed = JSON.parse(jsonMatch[0]) as GeneratedService;

      if (!parsed.nom) {
        throw new InternalServerErrorException('Champ "nom" manquant dans la réponse IA');
      }

      // Garanties finales
      parsed.statut = 'ACTIF';
      parsed.responsableId = '';
      if (!Array.isArray(parsed.horaires)) parsed.horaires = [];

      // Valeurs par défaut si le modèle a quand même laissé des vides
      if (!parsed.telephone) parsed.telephone = '+216 71 ' + Math.floor(100000 + Math.random() * 900000);
      if (!parsed.email) parsed.email = parsed.nom.toLowerCase().replace(/\s+/g, '-') + '@hopital.tn';
      if (!parsed.capacite || parsed.capacite === 0) parsed.capacite = 20;
      if (!parsed.tempsAttenteMoyen || parsed.tempsAttenteMoyen === 0) parsed.tempsAttenteMoyen = 30;
      if (!parsed.localisation) parsed.localisation = 'Bâtiment Principal - Rez-de-chaussée';

      return parsed;

    } catch (err) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) throw err;
      if (err instanceof SyntaxError) throw new InternalServerErrorException('La réponse n\'est pas un JSON valide');
      throw new InternalServerErrorException(`Erreur IA : ${err.message}`);
    }
  }
}