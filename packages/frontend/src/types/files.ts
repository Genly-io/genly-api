export interface WorkspaceFileOwner {
  type: "WORKSPACE";
  workspaceId: string;
}

export interface UserFileOwner {
  type: "USER";
  userId: string;
}

export type InternalFileOwner = WorkspaceFileOwner | UserFileOwner;

export interface InvalidPlatformBase {
  type: string;
  code: string;
}

export interface InternalFileBase {
  id: string;
  owner: InternalFileOwner;
  name: string;
  path: string;
  status: "PENDING" | "COMPLETE";
  size?: number; // Bytes.
  hasBeenUsed?: boolean;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}

export interface ImageSizeInvalidPlatform extends InvalidPlatformBase {
  code: "0001";
}

export interface ImageResolutionInvalidPlatform extends InvalidPlatformBase {
  code: "0002";
}

export type ImageInvalidPlatform =
  | ImageSizeInvalidPlatform
  | ImageResolutionInvalidPlatform;

export interface InternalFileImage extends InternalFileBase {
  type: "IMAGE";
  contentType: "image/jpeg" | "image/png";
  invalidPlatforms?: ImageInvalidPlatform[];
  width?: number;
  height?: number;
  preview?: {
    id: string;
    path: string;
    blurHash: string;
    width: number;
    height: number;
  };
}

export interface VideSizeInvalidPlatform extends InvalidPlatformBase {
  code: "0003";
}

export interface VideoResolutionInvalidPlatform extends InvalidPlatformBase {
  code: "0004";
}

export interface VideoDurationInvalidPlatform extends InvalidPlatformBase {
  code: "0005";
}

export type VideoInvalidPlatform =
  | VideSizeInvalidPlatform
  | VideoResolutionInvalidPlatform
  | VideoDurationInvalidPlatform;

export interface InternalFileVideo extends InternalFileBase {
  type: "VIDEO";
  contentType: "video/mp4";
  invalidPlatforms?: VideoInvalidPlatform[];
  width?: number;
  height?: number;
  duration?: number; // Seconds.
  preview?: {
    gifId: string;
    gifPath: string;
    screenshotId: string;
    screenshotPath: string;
    screenshotBlurhash: string;
    width: number;
    height: number;
  };
}

export type InvalidPlatform = ImageInvalidPlatform | VideoInvalidPlatform;

export type InternalFile = InternalFileImage | InternalFileVideo;

export type InternalFileByType<T extends InternalFile["type"]> =
  T extends "IMAGE"
    ? InternalFileImage
    : T extends "VIDEO"
    ? InternalFileVideo
    : never;
