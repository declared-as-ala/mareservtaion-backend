import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Hotspot for 360° tour: positions a table marker in a scene by pitch/yaw.
 * Replaces AI detection — all hotspots are stored in DB.
 */
export interface ITableHotspot extends Document {
  venueId: Types.ObjectId;
  tableId: Types.ObjectId;
  sceneId: string; // e.g. "scene0" or video scene identifier
  pitch: number;   // vertical angle (radians or degrees depending on viewer)
  yaw: number;    // horizontal angle
  radius?: number; // optional marker size / click area
  label?: string; // optional tooltip (e.g. "Table 5")
}

const TableHotspotSchema = new Schema<ITableHotspot>(
  {
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', required: true },
    sceneId: { type: String, required: true },
    pitch: { type: Number, required: true },
    yaw: { type: Number, required: true },
    radius: { type: Number },
    label: { type: String },
  },
  { timestamps: false }
);

TableHotspotSchema.index({ venueId: 1, sceneId: 1 });

export const TableHotspot = mongoose.model<ITableHotspot>('TableHotspot', TableHotspotSchema);
