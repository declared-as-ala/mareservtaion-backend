import mongoose, { Schema, Document, Types } from 'mongoose';

export type PositionType = 'yaw_pitch' | 'matterport_anchor';

export interface IVector3 {
  x: number;
  y: number;
  z: number;
}

export interface TablePlacementDocument extends Document {
  venueId: Types.ObjectId;
  tableId: Types.ObjectId;
  virtualTourId?: Types.ObjectId;
  sceneId: string;
  floorIndex?: number;
  positionType: PositionType;
  yaw?: number;
  pitch?: number;
  anchorPosition?: IVector3;
  stemVector?: IVector3;
  createdAt: Date;
  updatedAt: Date;
}

const Vector3Schema = new Schema({ x: Number, y: Number, z: Number }, { _id: false });

const tablePlacementSchema = new Schema<TablePlacementDocument>(
  {
    venueId: {
      type: Schema.Types.ObjectId,
      ref: 'Venue',
      required: true,
      index: true,
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    virtualTourId: {
      type: Schema.Types.ObjectId,
      ref: 'VirtualTour',
      index: true,
    },
    sceneId: {
      type: String,
      required: true,
      trim: true,
    },
    floorIndex: { type: Number },
    positionType: {
      type: String,
      enum: ['yaw_pitch', 'matterport_anchor'],
      default: 'yaw_pitch',
    },
    yaw: { type: Number },
    pitch: { type: Number },
    anchorPosition: { type: Vector3Schema },
    stemVector: { type: Vector3Schema },
  },
  {
    timestamps: true,
  }
);

tablePlacementSchema.index({ venueId: 1, virtualTourId: 1, sceneId: 1, tableId: 1 }, { unique: true });

export const TablePlacement =
  mongoose.models.TablePlacement ||
  mongoose.model<TablePlacementDocument>('TablePlacement', tablePlacementSchema);

