import { Entity, ObjectIdColumn, Column } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity('roles')
export class Role {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  name: string;
}
