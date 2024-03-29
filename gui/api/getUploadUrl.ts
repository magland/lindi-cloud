/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEqualTo, isString, validateObject } from "@fi-sci/misc";
import allowCors from "../apiHelpers/allowCors.js";
import githubVerifyAccessToken from "../apiHelpers/githubVerifyAccessToken.js";
import getS3Client from "../apiHelpers/getS3Client.js";
import { Bucket } from "../apiHelpers/s3Helpers.js";

const BUCKET_CREDENTIALS = process.env.BUCKET_CREDENTIALS;
if (!BUCKET_CREDENTIALS) {
  throw Error("BUCKET_CREDENTIALS is not set");
}

type GetUploadUrlRequest = {
  type: "getUploadUrl";
  url: string;
};

const isGetUploadUrlRequest = (x: any): x is GetUploadUrlRequest => {
  return validateObject(x, {
    type: isEqualTo("getUploadUrl"),
    url: isString,
  });
};

export default allowCors(async (req, res) => {
  // check that it is a post request
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const rr = req.body;
  if (!isGetUploadUrlRequest(rr)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { url } = rr;
  const parts = url.split("/");

  if (!url.startsWith("https://lindi.neurosift.org/zones/")) {
    res.status(400).json({ error: "Invalid url in request *1*" });
    return;
  }

  const userName = parts[4];
  const zoneName = parts[5];
  const fileBasePart = parts[6];
  const fileName = parts.slice(7).join("/");

  if (!userName || !zoneName || !fileBasePart || !fileName) {
    res.status(400).json({ error: "Invalid url in request *2*" });
    return;
  }

  if (fileBasePart === "sha1") {
    // fileName should be like 00/00/00/0000000....
    const pp = fileName.split("/");
    if (pp.length !== 4) {
      res.status(400).json({ error: "Invalid url in request *3*" });
      return;
    }
    if (pp[0].length !== 2 || pp[1].length !== 2 || pp[2].length !== 2) {
      res.status(400).json({ error: "Invalid url in request *4*" });
      return;
    }
    if (pp[3].length !== 40) {
      res.status(400).json({ error: "Invalid url in request *5*" });
      return;
    }
    if (pp[3].slice(0, 6) !== pp[0] + pp[1] + pp[2]) {
      res.status(400).json({ error: "Invalid url in request *6*" });
      return;
    }
  } else if (fileBasePart === "f") {
    if (fileName.length > 1000) {
      res.status(400).json({ error: "Invalid url in request *7*" });
      return;
    }
    const pp = fileName.split("/");
    // check for any . or .. in the path
    if (pp.some((x) => x === "." || x === "..")) {
      res.status(400).json({ error: "Invalid url in request *8*" });
      return;
    }
    // check for empty parts
    if (pp.some((x) => x === "")) {
      res.status(400).json({ error: "Invalid url in request *9*" });
      return;
    }
  } else {
    res.status(400).json({ error: "Invalid url in request *10*" });
    return;
  }

  const accessToken = req.headers.authorization?.split(" ")[1]; // Extract the token

  if (!accessToken) {
    res.status(401).json({ error: "No access token provided" });
    return;
  }

  const verifiedGithubUserId = await githubVerifyAccessToken(accessToken);
  if (!verifiedGithubUserId) {
    throw Error("No user id found for access token");
  }
  if (verifiedGithubUserId !== userName) {
    res.status(401).json({ error: "Access token does not match zone user" });
    return;
  }

  const signedUrl = await createSignedUploadUrl(url);
  res.status(200).json({ signedUrl });
});

export const bucket: Bucket = {
  uri: "r2://neurosift-lindi",
  credentials: BUCKET_CREDENTIALS,
}

const createSignedUploadUrl = async (url: string) => {
  const pp = url.split("/");
  const keyInBucket = pp.slice(3).join("/");
  if (!keyInBucket.startsWith("zones/")) {
    throw Error("Unexpected: Invalid key in bucket");
  }

  return new Promise<string>((resolve, reject) => {
    const s3 = getS3Client(bucket);
    s3.getSignedUrl(
      "putObject",
      {
        Bucket: 'neurosift-lindi',
        Key: keyInBucket,
        Expires: 60 * 30, // seconds
      },
      (err, url) => {
        if (err) {
          reject(new Error(`Error getting signed url: ${err.message}`));
          return;
        }
        if (!url) {
          reject(new Error("Unexpected, url is undefined"));
          return;
        }
        resolve(url);
      }
    );
  });
};
