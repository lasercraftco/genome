"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Settings as SettingsIcon } from "lucide-react";

export default function AdminSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [explorationRatio, setExplorationRatio] = useState([0.2]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Placeholder: in real implementation, this would call an API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Discovery defaults saved (engine restart not required)");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Discovery Defaults
        </h2>
        <p className="text-sm text-text-dim">Configure default settings for new stations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exploration Ratio</CardTitle>
          <CardDescription>
            Balance between familiar music and new discoveries (0 = all familiar, 1 = all new)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={explorationRatio}
              onValueChange={setExplorationRatio}
            />
            <div className="text-sm text-text-dim text-right">
              {(explorationRatio[0] * 100).toFixed(0)}%
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tag Weight</CardTitle>
          <CardDescription>
            How much to weight genre/mood tags in recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="number" placeholder="1.0" min="0" max="5" step="0.1" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Weight</CardTitle>
          <CardDescription>
            How much to weight audio features (energy, danceability, etc)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="number" placeholder="1.0" min="0" max="5" step="0.1" />
        </CardContent>
      </Card>

      <Button
        size="lg"
        onClick={handleSave}
        disabled={isLoading}
        className="w-full sm:w-auto"
      >
        {isLoading ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
