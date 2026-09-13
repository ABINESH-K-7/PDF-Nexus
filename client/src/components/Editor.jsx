import { useEffect, useRef, useState } from "react";
import { File } from "lucide-react";
import axios from "axios";
import { API_URL } from "../config/api";

export default function Editor({
  activeFile,
  updateContent,
  uploadFile
}) {
  const editorFileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);

  // PDF blob URL
  const [pdfUrl, setPdfUrl] = useState(null);


  /* =========================
     TEXT FILE LOADER
  ========================= */

  useEffect(() => {

    if (
      !activeFile ||
      activeFile.fileType !== "text" ||
      !activeFile.url ||
      activeFile.content
    ) {
      return;
    }


    const loadTextFile = async () => {

      try {

        setLoading(true);


        const res = await axios.get(
          `${API_URL}${activeFile.url}`,
          {
            withCredentials: true
          }
        );


        updateContent(res.data);


      } catch (err) {

        console.error(
          "Failed to load text file:",
          err
        );

        updateContent("// Failed to load file");


      } finally {

        setLoading(false);

      }

    };


    loadTextFile();

  }, [activeFile?.url]);


  /* =========================
     PDF LOADER
  ========================= */

  useEffect(() => {

    // Reset PDF URL if selected file is not PDF
    if (
      !activeFile ||
      activeFile.fileType !== "pdf" ||
      !activeFile.url
    ) {

      setPdfUrl(null);

      return;
    }


    let objectUrl = null;


    const loadPdf = async () => {

      try {

        setLoading(true);


        const token =
          localStorage.getItem("accessToken");


        const headers = {};


        /*
          Add Authorization header
          only if token exists
        */

        if (token) {

          headers.Authorization =
            `Bearer ${token}`;

        }


        console.log(
          "Loading PDF:",
          activeFile.url
        );


        const response = await axios.get(

          `${API_URL}${activeFile.url}`,

          {
            responseType: "blob",

            withCredentials: true,

            headers
          }

        );


        // Create browser Blob URL
        objectUrl =
          URL.createObjectURL(
            new Blob(
              [response.data],
              {
                type: "application/pdf"
              }
            )
          );


        setPdfUrl(objectUrl);


      } catch (err) {

        console.error(
          "Failed to load PDF:",
          err
        );


        setPdfUrl(null);


      } finally {

        setLoading(false);

      }

    };


    loadPdf();


    /*
      Cleanup old Blob URL
      when switching PDFs
    */

    return () => {

      if (objectUrl) {

        URL.revokeObjectURL(
          objectUrl
        );

      }

    };


  }, [activeFile?.url, activeFile?.fileType]);


  /* =========================
     EMPTY STATE
  ========================= */

  if (!activeFile) {

    return (

      <div
        className="
          w-full h-full
          flex flex-col
          items-center
          justify-center
          text-neutral-500
          border-t
          border-neutral-800
          cursor-pointer
          hover:text-neutral-300
        "

        onClick={() =>
          editorFileInputRef.current?.click()
        }
      >

        <File
          size={48}
          strokeWidth={1.2}
          className="mb-3"
        />

        <div className="text-sm">
          Open a file
        </div>


        {/* Hidden File Input */}

        <input

          ref={editorFileInputRef}

          type="file"

          hidden

          onChange={uploadFile}

        />

      </div>

    );

  }


  /* =========================
     PDF VIEWER
  ========================= */

  if (
    activeFile.fileType === "pdf"
  ) {

    return (

      <div className="
        w-full
        h-full
        border-t
        border-neutral-800
        relative
      ">


        {/* Loading */}

        {loading && (

          <div className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            bg-neutral-900
            text-neutral-400
            z-10
          ">

            Loading PDF...

          </div>

        )}


        {/* PDF */}

        {!loading && pdfUrl && (

          <iframe

            src={pdfUrl}

            title={activeFile.name}

            className="
              w-full
              h-full
              bg-white
            "

          />

        )}


        {/* Error */}

        {!loading && !pdfUrl && (

          <div className="
            w-full
            h-full
            flex
            items-center
            justify-center
            text-red-400
            bg-neutral-900
          ">

            Failed to load PDF

          </div>

        )}

      </div>

    );

  }


  /* =========================
     TEXT EDITOR
  ========================= */

  return (

    <div className="
      w-full
      h-full
      border-t
      border-neutral-800
    ">


      {loading ? (

        <div className="
          p-4
          text-neutral-400
        ">

          Loading file…

        </div>


      ) : (

        <textarea

          value={
            activeFile.content || ""
          }


          onChange={(e) => {

            updateContent(
              e.target.value
            );

          }}


          className="
            w-full
            h-full
            bg-neutral-900
            text-neutral-200
            font-mono
            p-4
            outline-none
            resize-none
          "

        />

      )}

    </div>

  );

}
