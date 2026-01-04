import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YearInReviewOverlayProps {
  year?: number;
}

const YearInReviewOverlay = ({ year = new Date().getFullYear() - 1 }: YearInReviewOverlayProps) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const dayOfYear = Math.floor((now.getTime() - new Date(currentYear, 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const isFirstWeek = dayOfYear <= 7;

    // Check if user has dismissed the overlay for this year
    const dismissedKey = `yearInReviewDismissed_${year}`;
    const isDismissed = localStorage.getItem(dismissedKey) === "true";

    // Show if it's the first week of the year AND not dismissed
    if (isFirstWeek && !isDismissed) {
      setVisible(true);
    }
  }, [year]);

  const handleDismiss = () => {
    const dismissedKey = `yearInReviewDismissed_${year}`;
    localStorage.setItem(dismissedKey, "true");
    setVisible(false);
  };

  const handleViewReview = () => {
    handleDismiss();
    navigate(`/year-in-review?year=${year}`);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative mx-4 max-w-sm w-full bg-gradient-to-br from-primary/20 via-background to-secondary/20 rounded-2xl border border-primary/30 p-6 shadow-2xl">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/50 transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/20">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Your {year} Year in Review
            </h2>
            <p className="mt-2 text-muted-foreground text-sm">
              Celebrate your intimate moments together. See your highlights, streaks, and favourite ways to connect.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <Button
              onClick={handleViewReview}
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              View Your Year
            </Button>
            <button
              onClick={handleDismiss}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearInReviewOverlay;
