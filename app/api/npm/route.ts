import { NextResponse } from 'next/server';
import axios from 'axios';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const NPM_API_URL = 'https://api.npmjs.org';

// Initial set of popular packages to seed the results
const POPULAR_PACKAGES = [
  'react', 'next', 'vue', 'express', 'typescript',
  'lodash', 'axios', 'moment', 'webpack', 'jest',
  'tailwindcss', 'vite', 'prisma', 'zod', 'react-router-dom',
  'react-query', 'redux', '@mui/material', 'graphql', 'eslint'
];

// Popular packages by category
const FRAMEWORK_PACKAGES: { [key: string]: string[] } = {
  nextjs: [
    'next', '@next/font', '@next/bundle-analyzer', '@next/env',
    'next-themes', 'next-auth', '@next/mdx', 'next-seo'
  ],
  vuejs: [
    'vue', '@vue/cli', '@vue/compiler-sfc', 'vue-router',
    'vuex', '@vue/reactivity', 'vue-loader', 'vue-template-compiler'
  ],
  react: [
    'react', 'react-dom', '@types/react', 'react-router-dom',
    'react-query', 'react-hook-form', '@tanstack/react-query',
    'react-icons', 'react-select', '@emotion/react'
  ],
  ui: [
    'tailwindcss', '@mui/material', 'styled-components',
    'framer-motion', '@chakra-ui/react', '@radix-ui/react-dialog',
    'shadcn-ui', '@headlessui/react'
  ],
  testing: [
    'jest', '@testing-library/react', 'vitest', 'cypress',
    'playwright', '@testing-library/jest-dom', 'msw',
    '@testing-library/user-event'
  ],
  utilities: [
    'lodash', 'axios', 'date-fns', 'zod', 'uuid',
    'classnames', 'prettier', 'eslint'
  ]
};

async function getPackageDetails(packageName: string) {
  try {
    const [npmResponse, downloadsResponse] = await Promise.all([
      axios.get(`${NPM_REGISTRY_URL}/${packageName}`),
      axios.get(`${NPM_API_URL}/downloads/point/last-week/${packageName}`)
    ]);

    const data = npmResponse.data;
    const latestVersion = data['dist-tags']?.latest;
    const latestVersionData = data.versions?.[latestVersion];

    if (!latestVersion || !latestVersionData) {
      console.error(`Missing version data for package ${packageName}`);
      return null;
    }

    // Normalize repository URL
    let repoUrl = null;
    if (typeof data.repository === 'string') {
      repoUrl = data.repository;
    } else if (data.repository?.url) {
      repoUrl = data.repository.url;
    }

    if (repoUrl) {
      // Remove git+ prefix if present
      repoUrl = repoUrl.replace(/^git\+/, '');
      // Convert git:// to https://
      repoUrl = repoUrl.replace(/^git:\/\//, 'https://');
      // Convert git+ssh://git@github.com to https://github.com
      repoUrl = repoUrl.replace(/^git\+ssh:\/\/git@/, 'https://');
      // Remove .git suffix if present
      repoUrl = repoUrl.replace(/\.git$/, '');
    }

    return {
      name: data.name,
      version: latestVersion,
      description: data.description || '',
      author: typeof data.author === 'string' ? data.author : data.author?.name || 'Unknown',
      license: data.license || 'Not specified',
      dependencies: Object.keys(latestVersionData.dependencies || {}).length,
      weeklyDownloads: downloadsResponse.data.downloads.toString(),
      links: {
        npm: `https://www.npmjs.com/package/${packageName}`,
        homepage: data.homepage || undefined,
        repository: repoUrl || undefined
      }
    };
  } catch (error) {
    console.error(`Error fetching details for ${packageName}:`, error);
    return null;
  }
}

async function getTopDownloaded(page: number = 1, limit: number = 21) {
  try {
    const response = await axios.get(`${NPM_REGISTRY_URL}/-/v1/search`, {
      params: {
        text: 'popularity:>1000',
        size: limit,
        from: (page - 1) * limit,
        quality: 0.0,
        popularity: 1.0,
        maintenance: 0.0
      }
    });

    const packages = response.data.objects;
    
    // Get full details for each package
    const detailsPromises = packages.map((pkg: { package: { name: string; }; }) => getPackageDetails(pkg.package.name));
    const details = await Promise.all(detailsPromises);
    const validDetails = details.filter(Boolean);

    // Sort by weekly downloads
    validDetails.sort((a: any, b: any) => 
      parseInt(b.weeklyDownloads) - parseInt(a.weeklyDownloads)
    );
    
    return {
      objects: validDetails.map(pkg => ({ package: pkg })),
      hasMore: response.data.total > page * limit
    };
  } catch (error) {
    console.error('Error getting top packages:', error);
    return {
      objects: [],
      hasMore: false
    };
  }
}

async function searchPackages(query: string) {
  try {
    const response = await axios.get(`${NPM_REGISTRY_URL}/-/v1/search`, {
      params: {
        text: query,
        size: 20
      }
    });

    const packages = response.data.objects;
    
    // Get full details for each package
    const detailsPromises = packages.map((pkg: { package: { name: string; }; }) => getPackageDetails(pkg.package.name));
    const details = await Promise.all(detailsPromises);
    const validDetails = details.filter(Boolean);

    return {
      objects: validDetails.map(pkg => ({ package: pkg }))
    };
  } catch (error) {
    console.error('Error searching packages:', error);
    return {
      objects: []
    };
  }
}

async function getFrameworkPackages(framework: string) {
  const frameworkQueries: { [key: string]: string } = {
    nextjs: 'keywords:nextjs',
    vuejs: 'keywords:vue',
    react: 'keywords:react',
    ui: 'keywords:ui',
    testing: 'keywords:testing',
    utilities: 'keywords:utilities'
  };

  const query = frameworkQueries[framework] || framework;
  return searchPackages(query);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const framework = searchParams.get('framework');
    const page = parseInt(searchParams.get('page') || '1');

    let result;
    if (query) {
      result = await searchPackages(query);
    } else if (framework) {
      result = await getFrameworkPackages(framework);
    } else {
      result = await getTopDownloaded(page);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch packages',
      objects: []
    }, { status: 500 });
  }
}
