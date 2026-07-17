import mongoose, { type HydratedDocument, type Types } from "mongoose";

export interface IGroup {
  name: string;
  description: string;
  avatar: string;
  admin: Types.ObjectId;
  members: Types.ObjectId[];
}

export type GroupDocument = HydratedDocument<IGroup>;

const groupSchema = new mongoose.Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
      maxlength: 60,
    },
    description: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

const Group = mongoose.model<IGroup>("Group", groupSchema);

export default Group;
