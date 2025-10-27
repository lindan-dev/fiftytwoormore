import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be less than 72 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidToken, setIsValidToken] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid recovery token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidToken(true);
      } else {
        toast({
          title: "Invalid or expired link",
          description: "Please request a new password reset link.",
          variant: "destructive"
        });
        navigate("/");
      }
    });
  }, [navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const result = passwordSchema.safeParse({ password, confirmPassword });
      if (!result.success) {
        const firstError = result.error.errors[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: result.data.password
      });

      if (error) throw error;

      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset."
      });

      // Redirect to home page
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isValidToken) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-soft border-2 border-primary/20 animate-scale-in">
        <CardHeader className="text-center space-y-3 sm:space-y-4 p-4 sm:p-6">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center shadow-soft">
            <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="white" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">
            Reset Password
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleResetPassword} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="New Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                disabled={loading} 
                className="h-10 sm:h-12 border-2 focus:border-primary transition-colors text-sm sm:text-base" 
              />
            </div>
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="Confirm New Password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                disabled={loading} 
                className="h-10 sm:h-12 border-2 focus:border-primary transition-colors text-sm sm:text-base" 
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-10 sm:h-12 text-base sm:text-lg font-semibold"
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => navigate("/")} 
              disabled={loading} 
              className="w-full text-sm sm:text-base"
            >
              Back to home
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
