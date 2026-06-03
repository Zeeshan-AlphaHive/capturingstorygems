import Header from "@/components/Header";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-w-0 w-full">
      <Header/>
      <div className="min-w-0 w-full">
        {children}
      </div>
    </div>
  );
};

export default Layout;
