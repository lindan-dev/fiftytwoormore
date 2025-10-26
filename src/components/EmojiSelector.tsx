import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmojiSelectorProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

const EMOJI_PRESETS = [
  { emoji: "🍑", label: "Peach" },
  { emoji: "🍆", label: "Eggplant" },
  { emoji: "💋", label: "Kiss" },
  { emoji: "👅", label: "Tongue" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "💦", label: "Water Drops" },
  { emoji: "🌶️", label: "Hot" },
  { emoji: "🍒", label: "Cherry" },
  { emoji: "🍌", label: "Banana" },
  { emoji: "🥵", label: "Hot Face" },
  { emoji: "😈", label: "Devil" },
  { emoji: "👄", label: "Lips" },
  { emoji: "💕", label: "Hearts" },
  { emoji: "✨", label: "Sparkles" },
  { emoji: "🎀", label: "Ribbon" },
  { emoji: "🧊", label: "Ice" },
  { emoji: "🕯️", label: "Candle" },
  { emoji: "🌙", label: "Moon" },
  { emoji: "🌹", label: "Rose" },
  { emoji: "💎", label: "Gem" },
  { emoji: "🎭", label: "Masks" },
  { emoji: "🦋", label: "Butterfly" },
  { emoji: "🌊", label: "Wave" },
  { emoji: "⛓️", label: "Chains" },
  { emoji: "🛏️", label: "Bed" },
  { emoji: "🛋️", label: "Sofa" },
  { emoji: "🧺", label: "Rug" },
  { emoji: "🪑", label: "Chair" },
  { emoji: "🍽️", label: "Dining" },
  { emoji: "🥕", label: "Carrot" },
  { emoji: "🚿", label: "Shower" },
  { emoji: "🌳", label: "Outdoor" },
  { emoji: "🚗", label: "Car" },
];

export default function EmojiSelector({ onSelect, selectedEmoji }: EmojiSelectorProps) {
  return (
    <Card className="p-4 border-2 border-primary/20">
      <ScrollArea className="h-[200px]">
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_PRESETS.map(({ emoji, label }) => (
            <Button
              key={emoji}
              variant={selectedEmoji === emoji ? "default" : "outline"}
              size="lg"
              onClick={() => onSelect(emoji)}
              className="text-2xl h-12 w-12 p-0 transition-all hover:scale-110"
              title={label}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
