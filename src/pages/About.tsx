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
            Because done is better than perfect
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="prose prose-sm sm:prose max-w-none">
            <p className="text-muted-foreground mb-4">
              Sex should be fun. Easy. And frequent. The more seldom we make time for each other, the more perfect we expect it to be when we do.
            </p>
            
            <p className="text-muted-foreground mb-4">
              A while back we realized that we laughed more during sex than we had done ever before. And we concluded that it was because we made time for it much more often than we had before.
            </p>
            
            <p className="text-muted-foreground mb-4">
              This app is created for couples who want to challenge their sex life and beat the 52 times a year.
            </p>
            
            <p className="text-muted-foreground">
              Privately and secure, this is for the two of you. No one else. Unless you want to.
            </p>

            <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
              Cheaper than therapy ❤️
            </h3>
            <p className="text-muted-foreground mb-3">
              Should fiftytwoormore bring a little more laughter, closeness, or "well… that was nice" into your week — consider backing the project with €5. It helps us make it even more fun.
            </p>
            <p className="text-muted-foreground">
              And it's cheaper than therapy.
            </p>
            <div className="text-center">
              <a 
                href="https://buy.stripe.com/14AbJ34zR6ofcci1fJ5EY00"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4"
              >
              <Button variant="outline" className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Support Our Project - €5 ❤️
              </Button>
              </a>
            </div>
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
