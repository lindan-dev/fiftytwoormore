import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Clock, Calendar, Lock, Flame } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
  startSlide?: number;
}

const slides = [
  {
    icon: Heart,
    title: "Because done is better than perfect. ❤️",
    subtitle: "Relationships aren't about perfection. They're about showing up, again and again.",
  },
  {
    icon: Clock,
    title: "Make time for each other. 😍",
    subtitle: "Life gets busy. This tiny app helps you actually make time for intimacy.",
  },
  {
    icon: Calendar,
    title: "52 or more. 📆",
    subtitle: "Once a week, every week. Just log it, keep your streak, and celebrate consistency.",
  },
  {
    icon: Lock,
    title: "Private. Always. 🔐",
    subtitle: "Only you and your partner can see your data. No tracking, no ads, no nothing.",
  },
  {
    icon: Heart,
    title: "Cheaper than therapy 💰",
    subtitle: "Save time and money, while having so much more fun.",
  },
  {
    icon: Flame,
    title: "Start your streak 🔥",
    subtitle: "Reconnect. Laugh. Because intimacy is built one small moment at a time.",
    isFinal: true,
  },
];

const Onboarding = ({ onComplete, startSlide = 0 }: OnboardingProps) => {
  const [currentSlide, setCurrentSlide] = useState(startSlide);
  const displaySlides = startSlide > 0 ? slides.slice(startSlide) : slides;
  const currentSlideData = displaySlides[currentSlide - startSlide];
  const Icon = currentSlideData.icon;

  const handleNext = () => {
    if (currentSlide - startSlide < displaySlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    setCurrentSlide(slides.length - 1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-8">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {displaySlides.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide - startSlide ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Main content card */}
        <Card className="p-8 sm:p-12 text-center animate-scale-in shadow-[var(--shadow-soft)] h-[450px] flex flex-col">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            </div>
          </div>

          {/* Title - Fixed height for 2 lines */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground h-[80px] sm:h-[96px] flex items-center justify-center mb-6">{currentSlideData.title}</h1>

          {/* Subtitle - Fixed starting position */}
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{currentSlideData.subtitle}</p>
        </Card>

        {/* Navigation */}
        <div className="flex flex-col gap-3 min-h-[120px]">
          {currentSlideData.isFinal ? (
            <>
              <Button onClick={onComplete} size="lg" className="w-full text-base sm:text-lg h-12 sm:h-14">
                Get Streaky
              </Button>
              <div className="h-11" />
            </>
          ) : (
            <>
              <Button onClick={handleNext} size="lg" className="w-full text-base sm:text-lg h-12 sm:h-14">
                Next
              </Button>
              <Button onClick={handleSkip} variant="ghost" size="lg" className="w-full">
                Skip
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
