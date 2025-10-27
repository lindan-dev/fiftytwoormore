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
  { emoji: "🍩", label: "Anal" },
  { emoji: "👉", label: "Fingering" },
  { emoji: "✂️", label: "Scissoring" },
  { emoji: "♋️", label: "69" },
  { emoji: "💃", label: "Striptease" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "💦", label: "Water Drops" },
  { emoji: "🌶️", label: "Hot" },
  { emoji: "🌽", label: "Porn" },
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
  { emoji: "🧺", label: "Laundry room" },
  { emoji: "🚿", label: "Shower" },
  { emoji: "🛁", label: "Bathtub" },
  { emoji: "🪑", label: "Chair" },
  { emoji: "🍽️", label: "Dining" },
  { emoji: "🥕", label: "Carrot" },
  { emoji: "🚿", label: "Shower" },
  { emoji: "🌳", label: "Outdoor" },
  { emoji: "🏖️", label: "Beach" },
  { emoji: "🏕️", label: "Tent" },
  { emoji: "🗺️", label: "Abroad" },
  { emoji: "🚗", label: "Car" },
  { emoji: "🚌", label: "Bus" },
  { emoji: "🚂", label: "Train" },
  { emoji: "✈️", label: "Airplane" },
  { emoji: "🛥️", label: "Boat" },
  { emoji: "🏩", label: "Hotell" },
  { emoji: "🚻", label: "Toilet" },
  { emoji: "🎥", label: "Recording" },
  { emoji: "☎️", label: "Phone sex" },
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
