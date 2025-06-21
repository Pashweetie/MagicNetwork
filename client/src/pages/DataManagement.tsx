import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Database, FileText, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DatabaseStats {
  cards: number;
  rulings: number;
  lastUpdate: string | null;
  missingData: {
    cardsWithoutOracleText: number;
    cardsWithoutKeywords: number;
    cardsWithoutRulings: number;
  };
}

interface BulkDataInfo {
  type: string;
  name: string;
  description: string;
  size: number;
  lastUpdated: string;
}

export default function DataManagement() {
  const [downloadingCards, setDownloadingCards] = useState(false);
  const [downloadingRulings, setDownloadingRulings] = useState(false);
  const queryClient = useQueryClient();

  // Get database statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/database/stats'],
    refetchInterval: 5000,
  });

  // Get available bulk data info
  const { data: bulkDataInfo } = useQuery({
    queryKey: ['/api/admin/database/bulk-data-info'],
  });

  // Download enhanced card data
  const downloadCardsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/database/download-enhanced-cards', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/stats'] });
      setDownloadingCards(false);
    },
    onError: () => setDownloadingCards(false),
  });

  // Download rulings
  const downloadRulingsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/database/download-rulings', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/stats'] });
      setDownloadingRulings(false);
    },
    onError: () => setDownloadingRulings(false),
  });

  const handleDownloadCards = () => {
    setDownloadingCards(true);
    downloadCardsMutation.mutate();
  };

  const handleDownloadRulings = () => {
    setDownloadingRulings(true);
    downloadRulingsMutation.mutate();
  };

  if (statsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database Management</h1>
          <p className="text-muted-foreground">Manage your Scryfall card database and download missing data</p>
        </div>
      </div>

      {/* Database Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cards?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.lastUpdate 
                ? `Updated ${new Date(stats.lastUpdate).toLocaleDateString()}`
                : 'Never updated'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Card Rulings</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.rulings?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Official rules clarifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Complete Oracle Text</span>
                <Badge variant={stats?.missingData?.cardsWithoutOracleText > 1000 ? "destructive" : "secondary"}>
                  {((stats?.cards - stats?.missingData?.cardsWithoutOracleText) / stats?.cards * 100 || 0).toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Has Keywords</span>
                <Badge variant={stats?.missingData?.cardsWithoutKeywords > 50000 ? "destructive" : "secondary"}>
                  {((stats?.cards - stats?.missingData?.cardsWithoutKeywords) / stats?.cards * 100 || 0).toFixed(1)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missing Data Issues */}
      {stats?.missingData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Data Gaps Detected
            </CardTitle>
            <CardDescription>
              Your database is missing some Scryfall data that could improve functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{stats.missingData.cardsWithoutOracleText.toLocaleString()}</strong> cards without oracle text
                  <br />
                  <span className="text-sm text-muted-foreground">Likely tokens, emblems, or art cards</span>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{stats.missingData.cardsWithoutKeywords.toLocaleString()}</strong> cards without keywords
                  <br />
                  <span className="text-sm text-muted-foreground">Missing ability word data</span>
                </AlertDescription>
              </Alert>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{stats.rulings || 0}</strong> rulings available
                  <br />
                  <span className="text-sm text-muted-foreground">
                    {stats.rulings > 1000 ? 'Good coverage' : 'Download recommended'}
                  </span>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Bulk Data */}
      {bulkDataInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Available Scryfall Data</CardTitle>
            <CardDescription>
              Current bulk data available from Scryfall API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bulkDataInfo.map((data: BulkDataInfo) => (
                <div key={data.type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{data.name}</div>
                    <div className="text-sm text-muted-foreground">{data.description}</div>
                    <div className="text-xs text-muted-foreground">
                      Size: {Math.round(data.size / 1024 / 1024)}MB
                    </div>
                  </div>
                  <Badge variant="outline">{data.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Enhanced Card Data
            </CardTitle>
            <CardDescription>
              Download Oracle Cards with complete field data including flavor text, printed names, 
              frame effects, and more detailed metadata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="font-medium">This will add:</div>
              <ul className="text-muted-foreground space-y-1 ml-4">
                <li>• Oracle IDs for better rulings linking</li>
                <li>• Flavor text and printed names</li>
                <li>• Frame effects and watermarks</li>
                <li>• Complete artist and illustration data</li>
                <li>• Game format availability (Arena, MTGO)</li>
                <li>• Promo and variation information</li>
              </ul>
            </div>
            <Separator />
            <Button 
              onClick={handleDownloadCards}
              disabled={downloadingCards}
              className="w-full"
            >
              {downloadingCards ? "Downloading..." : "Download Enhanced Data"}
            </Button>
            {downloadingCards && (
              <Progress value={undefined} className="w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Card Rulings
            </CardTitle>
            <CardDescription>
              Download official rules clarifications and interactions for all cards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="font-medium">This will add:</div>
              <ul className="text-muted-foreground space-y-1 ml-4">
                <li>• Official rules clarifications</li>
                <li>• Card interaction explanations</li>
                <li>• Publication dates and sources</li>
                <li>• Links to Oracle IDs for card matching</li>
              </ul>
            </div>
            <Separator />
            <Button 
              onClick={handleDownloadRulings}
              disabled={downloadingRulings}
              className="w-full"
              variant={stats?.rulings > 1000 ? "outline" : "default"}
            >
              {downloadingRulings ? "Downloading..." : stats?.rulings > 1000 ? "Update Rulings" : "Download Rulings"}
            </Button>
            {downloadingRulings && (
              <Progress value={undefined} className="w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Downloads may take several minutes depending on your internet connection. 
          The application will continue to work normally during downloads.
        </AlertDescription>
      </Alert>
    </div>
  );
}