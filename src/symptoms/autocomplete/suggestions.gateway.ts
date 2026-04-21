import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';

@WebSocketGateway({
    cors: {
        origin: '*',
        credentials: true,
    },
    namespace: '/suggestions',
})
@Injectable()
export class SuggestionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedClients = new Map<string, { userId: string; department: string }>();

    constructor(private readonly suggestionsService: SuggestionsService) {}

    async handleConnection(client: Socket) {
        const auth = client.handshake.auth;

        // Accepter userId sous différents noms possibles
        const userId =
            auth.userId ||
            auth.sub ||
            auth.id ||
            this.extractUserIdFromToken(auth.token);

        // Accepter department sous différents noms, avec fallback
        const department =
            auth.department ||
            auth.assignedDepartment ||
            this.extractDepartmentFromToken(auth.token) ||
            'General';

        console.log('[WS/suggestions] Connexion tentée:', { userId, department, auth });

        if (!userId) {
            console.warn('[WS/suggestions] Rejeté — auth reçu:', auth);
            client.disconnect();
            return;
        }

        this.connectedClients.set(client.id, { userId, department });
        console.log(`[WS/suggestions] Connecté: ${userId} (${department})`);
        client.emit('connected', { message: 'Connected to suggestions service' });
    }

    handleDisconnect(client: Socket) {
        const info = this.connectedClients.get(client.id);
        this.connectedClients.delete(client.id);
        console.log(`[WS/suggestions] Déconnecté: ${info?.userId ?? client.id}`);
    }

    @SubscribeMessage('get-validation-suggestions')
    async handleValidationSuggestions(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { responseId: string; patientContext?: string },
    ) {
        const clientInfo = this.connectedClients.get(client.id);
        if (!clientInfo) {
            client.emit('error', { message: 'Unauthorized' });
            return;
        }

        try {
            const suggestions = await this.suggestionsService.generateValidationSuggestions(
                data.responseId,
                clientInfo.department,
                data.patientContext,
            );

            client.emit('validation-suggestions', {
                responseId: data.responseId,
                suggestions,
                timestamp: new Date(),
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            client.emit('error', { message: errorMessage });
        }
    }

   // suggestions.gateway.ts
@SubscribeMessage('get-real-time-suggestions')
async handleRealTimeSuggestions(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { partialNote: string; responseId: string },
) {
    const clientInfo = this.connectedClients.get(client.id);
    console.log('[WS] get-real-time-suggestions reçu:', { 
        data, 
        clientInfo,
        clientId: client.id,
        isRegistered: !!clientInfo 
    });

    if (!clientInfo) {
        client.emit('error', { message: 'Unauthorized' });
        return;
    }

    try {
        const suggestions = await this.suggestionsService.getRealTimeSuggestions(
            data.partialNote,
            data.responseId,
            clientInfo.department,
        );

        console.log('[WS] Suggestions générées:', suggestions);

        client.emit('real-time-suggestions', {
            responseId: data.responseId,
            partialNote: data.partialNote,
            suggestions,
            timestamp: new Date(),
        });

        console.log('[WS] real-time-suggestions émis au client:', client.id);
    } catch (error) {
        console.error('[WS/suggestions] Real-time error:', error);
        client.emit('real-time-suggestions', {
            responseId: data.responseId,
            partialNote: data.partialNote,
            suggestions: { completions: [], medicalTerms: [] },
            timestamp: new Date(),
        });
    }
}

    // ─── Helpers JWT ───────────────────────────────────────────────────────────

    private extractUserIdFromToken(token?: string): string {
        if (!token) return '';
        try {
            const payload = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
            );
            return payload.sub || payload._id || payload.id || '';
        } catch {
            return '';
        }
    }

    private extractDepartmentFromToken(token?: string): string {
        if (!token) return '';
        try {
            const payload = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
            );
            return payload.assignedDepartment || payload.department || '';
        } catch {
            return '';
        }
    }
}