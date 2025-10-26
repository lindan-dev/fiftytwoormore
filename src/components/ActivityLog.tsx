import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Activity {
  id: string;
  activity_date: string;
  user_id: string;
}

interface ActivityLogProps {
  activities: Activity[];
  onDelete: (id: string) => void;
  currentUserId?: string;
}

export default function ActivityLog({ activities, onDelete, currentUserId }: ActivityLogProps) {
  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center border-2 border-dashed border-primary/20">
        <p className="text-muted-foreground">No activities logged yet. Start tracking your moments together!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <Card
          key={activity.id}
          className="p-4 flex items-center justify-between border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft animate-slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div>
            <p className="font-semibold text-lg">
              {format(new Date(activity.activity_date), "MMM d, yyyy")}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(activity.activity_date), "h:mm a")}
            </p>
          </div>
          {currentUserId === activity.user_id && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(activity.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
