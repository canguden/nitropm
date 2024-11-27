'use client';

import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Package, formatDownloads, getInstallCommand } from '@/lib/utils/npm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Github, Globe, Package as PackageIcon, Star, Download } from "lucide-react";
import { Navbar } from '@/components/navbar';
import { CopyButton } from '@/components/copy-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PackageList {
  error: any;
  objects: Array<{ package: Package }>;
  category?: string;
  hasMore: boolean;
}

interface PackageCardProps {
  pkg: Package;
  favorites: Set<string>;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  onToggleFavorite: (packageName: string) => void;
}

function PackageCard({ pkg, favorites, packageManager, onToggleFavorite }: PackageCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="h-5 w-5" />
              {pkg.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {pkg.description || 'No description available'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(pkg.name)}
            className={`transition-colors ${favorites.has(pkg.name) ? 'text-yellow-500 hover:text-yellow-600' : 'hover:text-yellow-500'}`}
          >
            <Star className={`h-4 w-4 ${favorites.has(pkg.name) ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {formatDownloads(pkg.weeklyDownloads)} weekly
          </Badge>
          <Badge variant="secondary">v{pkg.version}</Badge>
          {pkg.license && (
            <Badge variant="secondary">{pkg.license}</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div>Author: {pkg.author}</div>
          <div>Dependencies: {pkg.dependencies}</div>
        </div>

        <div className="mt-4 flex items-center gap-2 bg-muted p-2 rounded-md">
          <code className="text-sm flex-1 font-mono">
            {getInstallCommand(pkg.name, packageManager)}
          </code>
          <CopyButton value={getInstallCommand(pkg.name, packageManager)} />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex gap-2 w-full">
          {pkg.links?.repository && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              asChild
            >
              <a
                href={pkg.links.repository}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                Repository
              </a>
            </Button>
          )}
          {pkg.links?.homepage && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              asChild
            >
              <a
                href={pkg.links.homepage}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="h-4 w-4 mr-2" />
                Homepage
              </a>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default function Home() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('top');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritePackages, setFavoritePackages] = useState<Package[]>([]);
  const [packageManager, setPackageManager] = useState<'npm' | 'yarn' | 'pnpm'>('npm');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && activeTab === 'top') {
          loadMorePackages();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, activeTab, page]);

  const fetchPackages = async (params: { query?: string; category?: string; framework?: string; page?: number }) => {
    try {
      const searchParams = new URLSearchParams();
      if (params.query) searchParams.append('q', params.query);
      if (params.category) searchParams.append('category', params.category);
      if (params.framework) searchParams.append('framework', params.framework);
      if (params.page) searchParams.append('page', params.page.toString());
      
      const response = await fetch(`/api/npm?${searchParams.toString()}`);
      const data: PackageList = await response.json();
      
      if (data.error) {
        setError(data.error);
        setPackages([]);
      } else if (!data.objects || data.objects.length === 0) {
        setError('No packages found');
        setPackages([]);
      } else {
        setError(null);
        if (params.page && params.page > 1) {
          setPackages(prev => [...prev, ...data.objects.map((obj) => obj.package)]);
        } else {
          setPackages(data.objects.map((obj) => obj.package));
        }
        setHasMore(!!data.hasMore);
        setPage(params.page || 1);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setError('Failed to fetch packages. Please try again.');
      setPackages([]);
    }
  };

  const loadMorePackages = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      if (activeTab === 'top') {
        await fetchPackages({ category: 'top', page: page + 1 });
      } else if (activeTab === 'search' && searchQuery) {
        await fetchPackages({ query: searchQuery, page: page + 1 });
      } else if (['nextjs', 'vuejs', 'react', 'ui', 'testing', 'utilities'].includes(activeTab)) {
        await fetchPackages({ framework: activeTab, page: page + 1 });
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleFavorite = async (packageName: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(packageName)) {
        newFavorites.delete(packageName);
      } else {
        newFavorites.add(packageName);
      }
      // Save to localStorage
      localStorage.setItem('favorites', JSON.stringify(Array.from(newFavorites)));
      
      // Update favorite packages if we're on the favorites tab
      if (activeTab === 'favorites') {
        const currentPackage = packages.find(pkg => pkg.name === packageName);
        if (newFavorites.has(packageName) && currentPackage) {
          setFavoritePackages(prev => [...prev, currentPackage]);
        } else {
          setFavoritePackages(prev => prev.filter(pkg => pkg.name !== packageName));
        }
      }
      
      return newFavorites;
    });
  };

  const handleTabChange = async (newTab: string) => {
    // Set loading state immediately
    setLoading(true);
    // Clear error state
    setError(null);
    // Update active tab
    setActiveTab(newTab);
    // Reset page number
    setPage(1);
    // Clear search query if not on search tab
    if (newTab !== 'search') {
      setSearchQuery('');
    }
    
    try {
      if (newTab === 'favorites') {
        const favoritesArray = Array.from(favorites);
        if (favoritesArray.length > 0) {
          const favoritedPackages = packages.filter(pkg => favorites.has(pkg.name));
          setFavoritePackages(favoritedPackages);
        } else {
          setFavoritePackages([]);
        }
      } else {
        // Clear favorite packages when leaving favorites tab
        setFavoritePackages([]);
        
        // Fetch new packages based on tab
        if (newTab === 'search' && searchQuery) {
          await fetchPackages({ query: searchQuery });
        } else if (['nextjs', 'vuejs', 'react', 'ui', 'testing', 'utilities'].includes(newTab)) {
          await fetchPackages({ framework: newTab });
        } else if (newTab === 'top') {
          await fetchPackages({ category: 'top' });
        }
      }
    } catch (error) {
      console.error('Error switching tabs:', error);
      setError('Failed to load packages for this category');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveTab('search');
      setLoading(true);
      await fetchPackages({ query: searchQuery.trim() });
      setLoading(false);
    }
  };

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        const favSet = new Set<string>(JSON.parse(savedFavorites));
        setFavorites(favSet);
        // If we're on the favorites tab, load the favorite packages
        if (activeTab === 'favorites' && favSet.size > 0) {
          const favoritedPackages = packages.filter(pkg => favSet.has(pkg.name));
          setFavoritePackages(favoritedPackages);
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    }
    // Initial fetch for top packages if we're not on favorites tab
    if (activeTab !== 'favorites') {
      setLoading(true);
      fetchPackages({ category: 'top' }).finally(() => setLoading(false));
    }
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold">Nitro Package Explorer</h1>
              <p className="text-muted-foreground">
                Discover and explore the most popular NPM packages for your next project
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <form onSubmit={handleSearch} className="flex gap-2 flex-1">
                <Input
                  placeholder="Search packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-lg"
                />
                <Button type="submit" disabled={loading}>
                  {loading && activeTab === 'search' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Search
                </Button>
              </form>

              <Select value={packageManager} onValueChange={(value: 'npm' | 'yarn' | 'pnpm') => setPackageManager(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Package Manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="npm">npm</SelectItem>
                  <SelectItem value="yarn">yarn</SelectItem>
                  <SelectItem value="pnpm">pnpm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid grid-cols-4 lg:grid-cols-9 w-full">
                <TabsTrigger value="top" disabled={loading}>Most Downloaded</TabsTrigger>
                <TabsTrigger value="nextjs" disabled={loading}>Next.js</TabsTrigger>
                <TabsTrigger value="vuejs" disabled={loading}>Vue.js</TabsTrigger>
                <TabsTrigger value="react" disabled={loading}>React</TabsTrigger>
                <TabsTrigger value="ui" disabled={loading}>UI Libraries</TabsTrigger>
                <TabsTrigger value="testing" disabled={loading}>Testing</TabsTrigger>
                <TabsTrigger value="utilities" disabled={loading}>Utilities</TabsTrigger>
                <TabsTrigger value="favorites" disabled={loading}>Favorites</TabsTrigger>
                <TabsTrigger value="search" disabled={!searchQuery || loading}>Search Results</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p className="text-muted-foreground">Loading packages...</p>
                  </div>
                ) : error ? (
                  <div className="text-center text-red-500 mt-8">
                    {error}
                  </div>
                ) : activeTab === 'favorites' ? (
                  favoritePackages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {favoritePackages.map((pkg) => (
                        <PackageCard 
                          key={pkg.name} 
                          pkg={pkg} 
                          favorites={favorites} 
                          packageManager={packageManager} 
                          onToggleFavorite={toggleFavorite} 
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center mt-8">
                      <p className="text-muted-foreground">No favorite packages yet. Star some packages to add them to your favorites!</p>
                    </div>
                  )
                ) : packages.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {packages.map((pkg) => (
                        <PackageCard 
                          key={pkg.name} 
                          pkg={pkg} 
                          favorites={favorites} 
                          packageManager={packageManager} 
                          onToggleFavorite={toggleFavorite} 
                        />
                      ))}
                    </div>

                    {hasMore && !isLoadingMore && activeTab === 'top' && (
                      <div ref={observerTarget} className="h-4 w-full" />
                    )}

                    {isLoadingMore && (
                      <div className="flex justify-center mt-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center mt-8">
                    <p className="text-muted-foreground">No packages found. Try a different search term.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </>
  );
}
