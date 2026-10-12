# Synthesize speech with espeak-ng and record each word's start time (ground truth for sync tests).
import ctypes, json, sys, wave, struct, glob, os
root = sys.argv[1]; voice = sys.argv[2]; out = sys.argv[3]; text = sys.argv[4]
lib = ctypes.CDLL(glob.glob(os.path.join(root, 'espeakng_loader', '*.so*'))[0])
class EV(ctypes.Structure):
    _fields_ = [('type', ctypes.c_int), ('uid', ctypes.c_uint), ('text_position', ctypes.c_int), ('length', ctypes.c_int),
                ('audio_position', ctypes.c_int), ('sample', ctypes.c_int), ('user_data', ctypes.c_void_p), ('id', ctypes.c_char * 8)]
CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.POINTER(EV))
samples, words = [], []
def cb(wav, n, ev):
    if wav and n > 0: samples.extend(wav[:n])
    i = 0
    while ev[i].type != 0:
        if ev[i].type == 1: words.append((ev[i].text_position, ev[i].length, ev[i].audio_position))
        i += 1
    return 0
cbf = CB(cb)
sr = lib.espeak_Initialize(2, 0, os.path.join(root, 'espeakng_loader', 'espeak-ng-data').encode(), 0)
lib.espeak_SetSynthCallback(cbf)
lib.espeak_SetVoiceByName(voice.encode())
lib.espeak_SetParameter(1, 150, 0)  # rate wpm
b = text.encode('utf-8')
lib.espeak_Synth(b, len(b) + 1, 0, 1, 0, 1, None, None)  # POS_CHARACTER, espeakCHARS_UTF8
lib.espeak_Synchronize()
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(struct.pack('<%dh' % len(samples), *samples))
# text_position is 1-based character index
chars = list(text)
res = []
for tp, ln, ms in words:
    res.append({'text': ''.join(chars[tp - 1: tp - 1 + ln]), 'start': ms / 1000})
json.dump({'sr': sr, 'duration': len(samples) / sr, 'words': res}, open(out + '.json', 'w'), ensure_ascii=False, indent=0)
print(sr, len(samples) / sr, res[:5], res[-2:])
