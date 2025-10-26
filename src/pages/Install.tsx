import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, MoreVertical, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    const android = /android/.test(userAgent);
    
    setIsIOS(ios);
    setIsAndroid(android);

    // Capture the beforeinstallprompt event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Already Installed!</CardTitle>
            <CardDescription>
              The app is already installed on your device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Download className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl">Install fiftytwoormore</CardTitle>
            <CardDescription className="text-base">
              Get the full app experience on your device
            </CardDescription>
          </CardHeader>
        </Card>

        {deferredPrompt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Quick Install
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Click the button below to install the app directly to your device.
              </p>
              <Button onClick={handleInstallClick} size="lg" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Install App
              </Button>
            </CardContent>
          </Card>
        )}

        {isIOS && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share className="w-5 h-5" />
                Install on iPhone/iPad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Tap the <strong>Share</strong> button at the bottom of Safari (square with arrow pointing up)</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">2.</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">3.</span>
                  <span>Tap <strong>"Add"</strong> in the top right corner</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">4.</span>
                  <span>The app will appear on your home screen!</span>
                </li>
              </ol>
              <div className="bg-muted p-3 rounded-lg text-xs text-muted-foreground">
                <strong>Note:</strong> This only works in Safari browser on iOS devices.
              </div>
            </CardContent>
          </Card>
        )}

        {isAndroid && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MoreVertical className="w-5 h-5" />
                Install on Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Tap the <strong>menu button</strong> (three dots) in Chrome</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">2.</span>
                  <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">3.</span>
                  <span>Tap <strong>"Install"</strong> to confirm</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-primary">4.</span>
                  <span>The app will appear on your home screen!</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        )}

        {!isIOS && !isAndroid && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Install on Desktop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Look for an install icon in your browser's address bar, or check your browser menu for an "Install" option.
              </p>
              <div className="bg-muted p-3 rounded-lg text-xs text-muted-foreground">
                <strong>Supported browsers:</strong> Chrome, Edge, Opera, Brave, and other Chromium-based browsers.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-sm">
            Skip and use in browser
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Install;