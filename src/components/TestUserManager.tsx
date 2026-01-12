import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserWithTestStatus {
  user_id: string;
  name: string | null;
  email: string;
  created_at: string;
  is_test_user: boolean;
}

export default function TestUserManager() {
  const [users, setUsers] = useState<UserWithTestStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch test user roles
      const { data: testRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "test_user");

      const testUserIds = new Set(testRoles?.map(r => r.user_id) || []);

      // Get emails from auth (we'll use user_id as fallback display)
      const usersWithStatus: UserWithTestStatus[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.name,
        email: `User ${p.user_id.substring(0, 8)}...`, // Placeholder - we don't have direct email access
        created_at: p.created_at,
        is_test_user: testUserIds.has(p.user_id),
      }));

      setUsers(usersWithStatus);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTestUser = async (userId: string, isCurrentlyTest: boolean) => {
    setUpdating(userId);
    try {
      if (isCurrentlyTest) {
        // Remove test_user role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "test_user");

        if (error) throw error;

        toast({
          title: "User updated",
          description: "User will now be included in statistics",
        });
      } else {
        // Add test_user role
        const { error } = await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: "test_user" }]);

        if (error) throw error;

        toast({
          title: "User marked as test",
          description: "User will be excluded from statistics",
        });
      }

      // Update local state
      setUsers(prev =>
        prev.map(u =>
          u.user_id === userId ? { ...u, is_test_user: !isCurrentlyTest } : u
        )
      );
    } catch (error: any) {
      console.error("Error toggling test user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const testUserCount = users.filter(u => u.is_test_user).length;
  const realUserCount = users.length - testUserCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Test User Management
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{realUserCount} real</Badge>
            <Badge variant="secondary">{testUserCount} test</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Test users are excluded from Funnel and Stats analytics, but still receive emails.
        </p>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {users.map(user => (
            <div
              key={user.user_id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {user.name || "Unnamed User"}
                  </span>
                  {user.is_test_user && (
                    <Badge variant="secondary" className="text-xs">
                      Test
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {user.user_id.substring(0, 8)}... • Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {updating === user.user_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Switch
                    checked={user.is_test_user}
                    onCheckedChange={() => toggleTestUser(user.user_id, user.is_test_user)}
                    aria-label={`Mark ${user.name || "user"} as test user`}
                  />
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No users found
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
