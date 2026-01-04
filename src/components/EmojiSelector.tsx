import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getEmojiPresets } from "@/lib/emojiLabels";

interface EmojiSelectorProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

export default function EmojiSelector({ onSelect, selectedEmoji }: EmojiSelectorProps) {
  const emojiPresets = getEmojiPresets();
  
  return (
    <Card className="p-4 border-2 border-primary/20">
      <ScrollArea className="h-[200px]">
        <div className="grid grid-cols-6 gap-2">
          {emojiPresets.map(({ emoji, label }) => (
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
