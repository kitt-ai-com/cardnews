import { z } from "zod";

export const InfoPatternId = z.enum(["I1", "I2", "I3", "I4", "I5", "I6"]);
export type InfoPatternId = z.infer<typeof InfoPatternId>;
