import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createNotificationOrchestrator } from "../_shared/notificationOrchestrator.ts";

serve(createNotificationOrchestrator("midweek-nudge"));
