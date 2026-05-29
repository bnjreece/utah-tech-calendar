import { z } from "zod";

export const submissionPayloadSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  link: z.string().url(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  isOnline: z.boolean(),
  venueName: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).default("UT").optional(),
  postalCode: z.string().max(20).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
  submitterName: z.string().max(100).optional(),
  submitterEmail: z.string().email().optional(),
});

export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;
