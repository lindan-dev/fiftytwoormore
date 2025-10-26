import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, ArrowLeft } from "lucide-react";

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-2xl shadow-soft border-2 border-primary/20 animate-scale-in">
        <CardHeader className="text-center space-y-3 sm:space-y-4 p-4 sm:p-6">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center shadow-soft">
            <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="white" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">
            About fiftytwoormore
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            [Your app description will go here]
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="prose prose-sm sm:prose max-w-none">
            <p className="text-muted-foreground">
              [Add your detailed about text here. This is a placeholder that you can replace with information about your app, its purpose, and how it helps couples track their activities together.]
            </p>
            
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
              How It Works
            </h3>
            <p className="text-muted-foreground">
              [Explain how your app works - placeholder text to be replaced.]
            </p>
            
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
              Why We Built This
            </h3>
            <p className="text-muted-foreground">
              [Share your motivation and story - placeholder text to be replaced.]
            </p>
          </div>
          
          <Button
            onClick={() => navigate("/")}
            className="w-full mt-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default About;
