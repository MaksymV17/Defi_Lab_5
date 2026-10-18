import { network } from "hardhat";
import { deployAll } from "./lib/deploy.js";

const { ethers } = await network.create();

const { coin, engine, name } = await deployAll(ethers);
console.log(`Токен ${name} розгорнуто: ${await coin.getAddress()}`);
console.log(`StableEngine розгорнуто:  ${await engine.getAddress()}`);
console.log(`Власник токена (Engine):  ${await coin.owner()}`);
