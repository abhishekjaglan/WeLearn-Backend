import { z } from 'zod';
import { DetailLevel } from '../types/summarization.types.js';

// Schema for creating a user
export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

// Schema for getting a user by firstName and lastName
export const getUserSchema = z.object({
  id: z.string(),
});

// Schema for deleting a user
export const deleteUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export const createRecordSchema = z.object({
  user: z.string().uuid("Invalid user ID"),
  mediaType: z.string().min(1, "Media type is required"),
  mediaName: z.string().min(1, "Media name is required"),
});

export const getRecordSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  recordId: z.string().uuid("Invalid record ID"),
});

export const deleteRecordSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  recordId: z.string().uuid("Invalid record ID"),
});

export const summarizationSchema = z.object({
  detailLevel: z.enum([DetailLevel.SHORT, DetailLevel.MEDIUM, DetailLevel.DETAILED]),
  userId: z.string(),
});