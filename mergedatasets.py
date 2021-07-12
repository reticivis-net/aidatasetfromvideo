import os
import shutil
import subprocess
import sys

# if no arguments passed
if len(sys.argv) == 1:
    print("usage: mergedatasets.py [infolder] [outfolder]\n"
          "merges all tacotron-compatible datasets in infolder into one dataset (outfolder)")
    sys.exit()
# argument length check
if not len(sys.argv) == 3:
    sys.exit(f"expected 2 arguments, got {len(sys.argv) - 1}.")
# infolder must be a folder
if not os.path.isdir(sys.argv[1]):
    sys.exit(f"\"{sys.argv[1]}\" is not a directory.")
# outfolder must be a folder
if os.path.exists(sys.argv[2]):
    sys.exit(f"\"{sys.argv[2]}\" already exists.")

outputfiles = []
with os.scandir(sys.argv[1]) as root_dir:  # set up input dir loop
    entry: os.DirEntry  # pycharm angy
    for entry in root_dir:  # for everything in the input dir
        if entry.is_dir():  # if it is a dir
            print(f"scanning {entry.name}...")  # probably a tacotron db, tell the user
            if not os.path.isfile(os.path.join(entry.path, "list.txt")):  # make sure list.txt exists
                # skip this dir if it doesnt
                print(f"no list.txt file found in {entry.name}, skipping.")
                continue
            # read list.txt
            with open(os.path.join(entry.path, "list.txt")) as listtxt:
                listtxt = listtxt.readlines()
            # for every entry in list.txt
            for i, line in enumerate(listtxt):
                # parse and validate the entry makes sense
                wav = line.split("|")
                if len(wav) != 2:
                    print(f"line {i} is malformed, skipping.")
                    continue
                if not os.path.isfile(os.path.join(entry.path, wav[0])):
                    print(f"couldn't find {wav[0]}, skipping.")
                    continue
                # add the filepath and the transcription to a list.
                outputfiles.append([os.path.join(entry.path, wav[0]), wav[1]])
print(f"copying {len(outputfiles)} files...")
# create the output dir
os.mkdir(sys.argv[2])
listtxt = []
# for every wav file/transcription pair collected by the previous loops
for i, (file, transcription) in enumerate(outputfiles):
    # copy the file to the new database
    shutil.copy2(file, os.path.join(sys.argv[2], f"{i}.wav"))
    # add it to the new list.txt file
    listtxt.append(f"{i}.wav|{transcription.strip()}")
print("writing list.txt...")
listtxt = "\n".join(listtxt)
with open(os.path.join(sys.argv[2], "list.txt"), "w+") as f:
    f.write(listtxt)
print("done creating dataset. you can quit the program if you don't care about the total size of the dataset.")
print("calculating size of dataset...")
# for every newly created file, ask ffmpeg for its length and add them all together. then tell the user.
duration = 0
for i in range(len(outputfiles)):
    wav = os.path.join(sys.argv[2], f"{i}.wav")
    proc = subprocess.Popen(["ffprobe", wav, "-v", "panic", "-show_entries", "format=duration", "-of",
                             "default=noprint_wrappers=1:nokey=1"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = proc.communicate()
    duration += float(stdout.strip())
print(f"your newly constructed dataset contains "
      f"{int(duration // 60)} minutes and {round(duration % 60, 2)} seconds of data.")
