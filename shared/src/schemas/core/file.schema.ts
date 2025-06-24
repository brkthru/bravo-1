import * as z from 'zod/v4';

// Creative asset file validation
export const CreativeFileSchema = z.file()
  .min(1000) // 1KB minimum
  .max(100_000_000) // 100MB maximum
  .mime([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'text/html',
  ]);

// Image file validation
export const ImageFileSchema = z.file()
  .min(1000) // 1KB minimum
  .max(10_000_000) // 10MB maximum
  .mime([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ]);

// Video file validation
export const VideoFileSchema = z.file()
  .min(10_000) // 10KB minimum
  .max(100_000_000) // 100MB maximum
  .mime([
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ]);

// Document file validation
export const DocumentFileSchema = z.file()
  .min(100) // 100 bytes minimum
  .max(50_000_000) // 50MB maximum
  .mime([
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
  ]);

// Bulk upload CSV file
export const BulkUploadFileSchema = z.file()
  .min(10) // 10 bytes minimum
  .max(10_000_000) // 10MB maximum
  .mime(['text/csv', 'application/csv']);

// File metadata schema
export const FileMetadataSchema = z.object({
  name: z.string(),
  size: z.number().int().positive(),
  type: z.string(),
  lastModified: z.number().int().positive(),
  url: z.string().url().optional(),
});

// Types
export type CreativeFile = z.infer<typeof CreativeFileSchema>;
export type ImageFile = z.infer<typeof ImageFileSchema>;
export type VideoFile = z.infer<typeof VideoFileSchema>;
export type DocumentFile = z.infer<typeof DocumentFileSchema>;
export type BulkUploadFile = z.infer<typeof BulkUploadFileSchema>;
export type FileMetadata = z.infer<typeof FileMetadataSchema>;