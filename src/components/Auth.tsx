import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";
import { z } from "zod";
const authSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be less than 72 characters"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters").optional()
});
export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const {
    toast
  } = useToast();
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Validate input using zod schema
      const validationData = isSignUp ? {
        email,
        password,
        name
      } : {
        email,
        password
      };
      const result = authSchema.safeParse(validationData);
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
      if (isSignUp) {
        const {
          error
        } = await supabase.auth.signUp({
          email: result.data.email,
          password: result.data.password,
          options: {
            data: {
              name: result.data.name
            }
          }
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "You can now sign in with your credentials."
        });
        setIsSignUp(false);
      } else {
        const {
          error
        } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password
        });
        if (error) throw error;
      }
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
  return <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-soft border-2 border-primary/20 animate-scale-in">
        <CardHeader className="text-center space-y-3 sm:space-y-4 p-4 sm:p-6">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center shadow-soft">
            <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="white" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">
            fiftytwoormore
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">Because done is better than perfect.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleAuth} className="space-y-3 sm:space-y-4">
            {isSignUp && <div className="space-y-2">
                <Input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required disabled={loading} className="h-10 sm:h-12 border-2 focus:border-primary transition-colors text-sm sm:text-base" />
              </div>}
            <div className="space-y-2">
              <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} className="h-10 sm:h-12 border-2 focus:border-primary transition-colors text-sm sm:text-base" />
            </div>
            <div className="space-y-2">
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} className="h-10 sm:h-12 border-2 focus:border-primary transition-colors text-sm sm:text-base" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10 sm:h-12 text-base sm:text-lg font-semibold">
              {loading ? "Loading..." : "Get Streaky"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsSignUp(!isSignUp)} disabled={loading} className="w-full text-sm sm:text-base">
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up here."}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>;
}