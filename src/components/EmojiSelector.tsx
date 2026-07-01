import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getEmojiPresets } from "@/lib/emojiLabels";

interface EmojiSelectorProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

export default function EmojiSelector({ onSelect, selectedEmoji }: EmojiSelectorProps) {
  const emojiPresets = getEmojiPresets();
  
  return (
    <Card className="p-2 sm:p-3 border-2 border-primary/20">
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 sm:gap-1.5">
        {emojiPresets.map(({ emoji, label }) => (
          <Button
            key={emoji}
            variant={selectedEmoji === emoji ? "default" : "outline"}
            onClick={() => onSelect(emoji)}
            className="text-lg sm:text-xl h-9 w-9 sm:h-10 sm:w-10 p-0 aspect-square transition-all"
            title={label}
            aria-label={label}
          >
            {emoji}
          </Button>
        ))}
      </div>
    </Card>
  );
}
