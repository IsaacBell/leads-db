#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import argparse
import functools
import concurrent.futures
import datetime
import shutil
import subprocess
import shlex

import code
import pprint

from datetime import datetime, timezone

# Script version
VERSION = '1.0'

# Options definition
parser = argparse.ArgumentParser(description="version: " + VERSION)

input_group = parser.add_argument_group('Input parameters')
input_group.add_argument('-f', '--fresh-dir', help='Input directory of the fresh data to merge', default = None, required = True)
input_group.add_argument('-r', '--referential-dir', help='Referential directory', default = None, required = True)

def print_horizontal_bar(width='large'):
    if width == 'large':
        print('-'*80)
    else:
        print('-'*10)

def print_result(res):
    for i in res:
        print(i)
    print()

def exec_cmd(cmd):
    # yes, I know, 'shell=True' is very bad
    p = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding='utf-8')
    print("[+] command:\t%s" % p.args)
    print("[+] retcode:\t%s" % p.returncode)
    
    print("[+] stdout:")
    print_result(p.stdout.splitlines())
    
    print("[+] stderr:")
    print_result(p.stderr.splitlines())
    
    print_horizontal_bar(width='small')
    
    return p

def merge(options):
    print("[+] fresh dir:\t\t'%s'" % options.fresh_dir)
    print("[+] referential dir:\t'%s'\n" % options.referential_dir)
    print_horizontal_bar()
    
    fresh = options.fresh_dir
    referential = options.referential_dir
    
    for fresh_dir in sorted(os.listdir(fresh)):
        print("[+] directory:\t%s" % fresh_dir)
        fresh_dir_full_path = os.path.join(fresh, fresh_dir)
        ref_dir_full_path = os.path.join(referential, fresh_dir)
        
        if os.path.isdir(fresh_dir_full_path) and not(os.path.exists(ref_dir_full_path)):
            print("[!] this subfolder exists in fresh but not in ref:\t'%s'" % (fresh_dir))
            os.makedirs(ref_dir_full_path)
            print("[!] this subfolder has been created in ref:\t\t'%s'" % (ref_dir_full_path))
        
        for fresh_file in sorted(os.listdir(fresh_dir_full_path)):
            #print(fresh_file)
            if fresh_file == 'today.gz':
                fresh_file_full_path_today = os.path.join(fresh_dir_full_path, fresh_file)
                ref_file_full_path_today = os.path.join(ref_dir_full_path, fresh_file)
                
                ref_file_full_path_today_new = os.path.join(ref_dir_full_path, "today_new.gz")
                ref_file_full_path_yesterday = os.path.join(ref_dir_full_path, 'yesterday.gz')
                ref_file_full_path_yesterday_new = os.path.join(ref_dir_full_path, "yesterday_new.gz")
                
                if os.path.isfile(fresh_file_full_path_today) and not(os.path.exists(ref_file_full_path_today)):
                    print("[!] this subfile exists in fresh but not in ref:\t'%s'" % (fresh_file_full_path_today))
                    shutil.copy(fresh_file_full_path_today, ref_file_full_path_today)
                    print("[!] this subfile has been copied from fresh to ref:\t'%s'" % (ref_file_full_path_today))
                    print_horizontal_bar()
                    
                    
                else:
                    print('[+] moving today*.gz files to yesterday*.gz')
                    # 1. mv today* files to yesterday*
                    # 1.1 move ref today to ref yesterday
                    cmd = "cp -f '%s' '%s'" % (ref_file_full_path_today, ref_file_full_path_yesterday)
                    exec_cp_ref_today_to_ref_yesterday = exec_cmd(cmd)
                    
                    if exec_cp_ref_today_to_ref_yesterday.returncode == 0:
                        # 1.2. move ref today_new to ref yesterday_new
                        cmd = "mv -f '%s' '%s'" % (ref_file_full_path_today_new, ref_file_full_path_yesterday_new)
                        exec_mv_ref_today_new_to_ref_yesterday_new = exec_cmd(cmd)
                        
                        
                        # 2. find differences
                        print('[+] comparing fresh today.gz with ref yesterday files to find newly created domains')
                        cmd = 'bash -c "comm -13 <(zcat \'%s\' | sort -u) <(zcat \'%s\' | sort -u) | tee | gzip > \'%s\'"' % (ref_file_full_path_today, fresh_file_full_path_today, ref_file_full_path_today_new)
                        exec_diff = exec_cmd(cmd)
                        
                        
                        if exec_diff.returncode == 0:
                            # if comparing today files has been successful, then:
                            # 3. move fresh today to ref today
                            cmd = "mv -f '%s' '%s'" % (fresh_file_full_path_today, ref_file_full_path_today)
                            exec_mv_fresh_today_to_ref_today = exec_cmd(cmd)
                            print_horizontal_bar()
                    
    
    
    return

def main():
    global parser
    options = parser.parse_args()
    
    if os.path.isdir(options.fresh_dir) and os.path.isdir(options.referential_dir):
        merge(options)
    
    return
    
if __name__ == "__main__" :
    main()
