"use client";

import { type Dispatch, SetStateAction, createContext, useState } from "react";

export const GlobalContext = createContext({
  userData: {
    name: "John Doe",
    picture: "",
  },
  setUserData: (() => {}) as Dispatch<SetStateAction<{ name: string; picture: string }>>,
});

export const GlobalProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState({
    name: "",
    picture: "",
  });

  return <GlobalContext.Provider value={{ userData, setUserData }}>{children}</GlobalContext.Provider>;
};
