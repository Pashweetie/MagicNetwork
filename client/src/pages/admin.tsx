import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Database, Download, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DownloadProgress {
  current: number;
  total: number;
  status: 'idle' | 'downloading' | 'complete' | 'error';
}

interface UpdateInfo {
  lastUpdate: string | null;
  daysSinceUpdate: number | null;
}

export function AdminPage() {
  const [cardCount, setCardCount] = useState<number>(0);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    current: 0,
    total: 0,
    status: 'idle'
  });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    lastUpdate: null,
    daysSinceUpdate: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchCardCount = async () => {
    try {
      const response = await fetch('/api/admin/cards/count');
      const data = await response.json();
      setCardCount(data.count);
    } catch (error) {
      console.error('Failed to fetch card count:', error);
    }
  };

  const fetchDownloadProgress = async () => {
    try {
      const response = await fetch('/api/admin/cards/download-progress');
      const data = await response.json();
      setDownloadProgress(data);
    } catch (error) {
      console.error('Failed to fetch download progress:', error);
    }
  };

  const fetchUpdateInfo = async () => {
    try {
      const response = await fetch('/api/admin/cards/last-update');
      const data = await response.json();
      setUpdateInfo(data);
    } catch (error) {
      console.error('Failed to fetch update info:', error);
    }
  };

  const initializeDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/cards/initialize', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast({
          title: "Database initialization started",
          description: "Card database is being populated in the background.",
        });
        
        // Start polling for progress
        const progressInterval = setInterval(() => {
          fetchDownloadProgress();
          fetchCardCount();
        }, 2000);

        // Stop polling when complete
        const checkComplete = setInterval(() => {
          fetchDownloadProgress().then(() => {
            if (downloadProgress.status === 'complete' || downloadProgress.status === 'error') {
              clearInterval(progressInterval);
              clearInterval(checkComplete);
              setIsLoading(false);
            }
          });
        }, 1000);
        
      } else {
        throw new Error('Failed to initialize database');
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      toast({
        title: "Initialization failed",
        description: "Failed to start database initialization.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const forceDownload = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/cards/download', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast({
          title: "Download started",
          description: "Force downloading all cards...",
        });
        
        // Start polling for progress
        const progressInterval = setInterval(() => {
          fetchDownloadProgress();
          fetchCardCount();
          fetchUpdateInfo();
        }, 2000);
        
      } else {
        throw new Error('Failed to start download');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Failed to start card download.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkForUpdates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/cards/check-updates', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast({
          title: "Update check completed",
          description: "Checked for new cards and updates.",
        });
        
        // Refresh all data
        fetchCardCount();
        fetchUpdateInfo();
        fetchDownloadProgress();
        
      } else {
        throw new Error('Failed to check for updates');
      }
    } catch (error) {
      console.error('Update check error:', error);
      toast({
        title: "Update check failed",
        description: "Failed to check for updates.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCardCount();
    fetchDownloadProgress();
    fetchUpdateInfo();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchCardCount();
      fetchDownloadProgress();
      fetchUpdateInfo();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    switch (downloadProgress.status) {
      case 'downloading':
        return <Badge variant="secondary" className="animate-pulse"><RefreshCw className="w-3 h-3 mr-1" />Downloading</Badge>;
      case 'complete':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  const progressPercentage = downloadProgress.total > 0 ? 
    (downloadProgress.current / downloadProgress.total) * 100 : 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Card Database Administration</h1>
        <p className="text-muted-foreground">
          Manage your local card database to improve search performance and reduce API calls.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Cards:</span>
              <span className="text-lg font-bold">{cardCount.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              {getStatusBadge()}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Update:</span>
              <span className="text-sm">
                {updateInfo.lastUpdate ? 
                  new Date(updateInfo.lastUpdate).toLocaleDateString() : 
                  'Never'
                }
              </span>
            </div>

            {updateInfo.daysSinceUpdate !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Days Since Update:</span>
                <span className={`text-sm ${updateInfo.daysSinceUpdate >= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {updateInfo.daysSinceUpdate}
                  {updateInfo.daysSinceUpdate >= 7 && ' (needs update)'}
                </span>
              </div>
            )}

            {downloadProgress.status === 'downloading' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress:</span>
                  <span>{downloadProgress.current} / {downloadProgress.total}</span>
                </div>
                <Progress value={progressPercentage} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  {progressPercentage.toFixed(1)}% complete
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Database Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button 
                onClick={initializeDatabase}
                disabled={isLoading || downloadProgress.status === 'downloading'}
                className="w-full"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                Initialize Database
              </Button>
              <p className="text-xs text-muted-foreground">
                Downloads all card data if database is empty
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button 
                onClick={checkForUpdates}
                disabled={isLoading || downloadProgress.status === 'downloading'}
                variant="outline"
                className="w-full"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Check for Updates
              </Button>
              <p className="text-xs text-muted-foreground">
                Checks for new cards and downloads if needed (weekly schedule)
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button 
                onClick={forceDownload}
                disabled={isLoading || downloadProgress.status === 'downloading'}
                variant="outline"
                className="w-full"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Force Re-download
              </Button>
              <p className="text-xs text-muted-foreground">
                Re-downloads all cards (may take 10-15 minutes)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>About Local Card Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The local card database downloads all Magic: The Gathering card data from Scryfall 
            and stores it locally to improve performance and reduce API calls.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Contains all cards with complete metadata including prices and legalities</li>
            <li>Enables instant search without network requests</li>
            <li>Automatically checks for updates weekly (7+ days old)</li>
            <li>Downloads only when new cards are available from Scryfall</li>
            <li>Fallback to Scryfall API if local data is unavailable</li>
          </ul>
          <p className="text-xs">
            <strong>Note:</strong> Initial download may take 10-15 minutes depending on your connection.
            The database contains over 100,000 cards.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}