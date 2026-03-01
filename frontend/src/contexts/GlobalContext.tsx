"use client";

import { type Dispatch, SetStateAction, createContext, useState } from "react";

export const GlobalContext = createContext({
  userData: {
    id: "",
    email: "",
    name: "",
    given_name: "",
    picture: "",
  },
  setUserData: (() => {}) as Dispatch<
    SetStateAction<{
      id: string;
      email: string;
      name: string;
      given_name: string;
      picture: string;
    }>
  >,
});

export const GlobalProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState({
    id: "",
    email: "",
    name: "",
    given_name: "",
    picture: "",
  });

  return <GlobalContext.Provider value={{ userData, setUserData }}>{children}</GlobalContext.Provider>;
};
