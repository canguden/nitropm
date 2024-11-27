import Link from 'next/link';
import { Github } from 'lucide-react';
import { Button } from './ui/button';
import { ModeToggle } from './mode-toggle';
import Image from 'next/image';
import logo from "@/public/logo.svg"

export function Navbar() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center space-x-4">
          <Link href="/" className="font-bold text-xl flex items-center">
           <Image src={logo} width={50} height={50} alt="Logo" className='invert dark:invert-0'/><span className='font-extrabold -ml-3'>
           pm</span>
          </Link>

        </div>
        <div className="ml-auto flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <a
              href="https://github.com/yourusername/cargodepot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
            </a>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
