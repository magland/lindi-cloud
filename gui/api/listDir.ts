/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEqualTo, isString, validateObject } from "@fi-sci/misc";
import allowCors from "../apiHelpers/allowCors.js";
import getS3Client from "../apiHelpers/getS3Client.js";
import { bucket } from "./getUploadUrl.js";

type ListDirRequest = {
  type: "listDir";
  url: string;
};

const isListDirRequest = (x: any): x is ListDirRequest => {
  return validateObject(x, {
    type: isEqualTo("listDir"),
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
  if (!isListDirRequest(rr)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { url } = rr;
  const parts = url.split("/");

  if (!url.startsWith("https://lindi.neurosift.org/zones")) {
    res.status(400).json({ error: "Invalid url in request *1*" });
    return;
  }

  const s3 = getS3Client(bucket);
  s3.listObjectsV2({
    Bucket: 'neurosift-lindi',
    Prefix: parts.slice(3).filter((x: string) => x).join('/') + '/',
    Delimiter: '/',
    ContinuationToken: undefined,
    MaxKeys: 1000
  }, (err, data) => {
    if (err) {
      res.status(400).json({ error: `Error listing objects: ${err.message}` });
      return;
    }
    const files = data.Contents.map((x: any) => ({ 
        name: x.Key.split('/').slice(-1)[0], 
        size: x.Size, // Include the file size
        lastModified: Math.floor(new Date(x.LastModified).getTime() / 1000) // Convert to seconds since epoch
    }));
    const dirNames = data.CommonPrefixes.map((x: any) => x.Prefix).map((x: string) => x.split('/').slice(-2, -1)[0]);
    res.status(200).json({ files, dirNames });
  });
});
