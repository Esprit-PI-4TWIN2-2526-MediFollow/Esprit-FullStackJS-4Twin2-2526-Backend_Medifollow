import { IsString } from 'class-validator';

export class SaveVoiceAnswerDto {
  @IsString()
  sessionId: string;

  @IsString()
  questionId: string;

  @IsString()
  digits: string;
}
